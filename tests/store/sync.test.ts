import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, entries } from 'idb-keyval';

const api = vi.hoisted(() => ({
  ensureFolder: vi.fn(), findFile: vi.fn(), getMeta: vi.fn(), download: vi.fn(), upload: vi.fn(),
}));
const gis = vi.hoisted(() => ({
  requestToken: vi.fn(),
  preloadGis: vi.fn(async () => {}),
  revoke: vi.fn(async () => {}),
  AuthCancelled: class AuthCancelled extends Error {},
}));
vi.mock('../../src/store/drive/api', async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock('../../src/store/drive/gis', () => gis);

import { setStore, listBackups, loadDriveState } from '../../src/store/persist';
import { app, flushSaves } from '../../src/store/app.svelte';
import { connect, disconnect, drive, warmDrive, reconnect, resolveConflict, syncNow } from '../../src/store/sync.svelte';
import { addPublication, emptyDataset } from '../../src/domain/dataset';
import { serializeDataset } from '../../src/domain/file';
import { DriveError } from '../../src/store/drive/api';

const TOKEN = 'secret-token-123';
const meta = (version: string) => ({ id: 'f1', version, modifiedTime: '2026-01-01T00:00:00Z' });
const withPub = (id: string, name: string) => {
  const ds = emptyDataset(id);
  addPublication(ds, { name, language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p-' + name);
  return ds;
};
let n = 0;
let store: ReturnType<typeof createStore>;

beforeEach(async () => {
  vi.clearAllMocks();
  store = createStore(`s${n++}`, 'kv');
  setStore(store);
  await disconnect();
  app.ds = emptyDataset('d1');
  app.lastSavedAt = null;
  gis.requestToken.mockResolvedValue({ token: TOKEN, expiresAt: Date.now() + 3_600_000 });
  api.ensureFolder.mockResolvedValue('folder');
  api.upload.mockResolvedValue(meta('2'));
});

const localWithData = () => { app.ds = withPub('d1', 'Book A'); return JSON.parse(JSON.stringify(app.ds)); };
const remoteJson = (ds: unknown) => serializeDataset(ds as never);

describe('drive sync', () => {
  it('connect with no remote uploads local', async () => {
    localWithData();
    api.findFile.mockResolvedValue(null);
    await connect();
    expect(api.upload).toHaveBeenCalledOnce();
    expect(api.upload.mock.calls[0][1]).toMatchObject({ datasetId: 'd1', name: 'pubcount.pubcount', folderId: 'folder' });
    expect(api.upload.mock.calls[0][1].id).toBeUndefined();
    expect(drive.status).toBe('idle');
    expect(await loadDriveState()).toMatchObject({ connected: true, fileId: 'f1', version: '2' });
  });

  it('connect with empty local restores remote', async () => {
    const remote = withPub('d1', 'Remote');
    api.findFile.mockResolvedValue(meta('5'));
    api.download.mockResolvedValue(remoteJson(remote));
    await connect();
    await flushSaves();
    expect(app.ds.publications[0].name).toBe('Remote');
    expect(api.upload).not.toHaveBeenCalled();
    expect((await listBackups())[0].reason).toBe('drive restore');
    expect((await loadDriveState()).version).toBe('5');
  });

  it('connect with both differing opens conflict and uploads nothing', async () => {
    localWithData();
    api.findFile.mockResolvedValue(meta('5'));
    api.download.mockResolvedValue(remoteJson(withPub('d1', 'Remote')));
    await connect();
    expect(drive.status).toBe('conflict');
    expect(drive.conflict?.local.publications).toBe(1);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('connect with equal data links the file without uploading', async () => {
    const ds = localWithData();
    api.findFile.mockResolvedValue(meta('5'));
    api.download.mockResolvedValue(remoteJson(ds));
    await connect();
    expect(drive.status).toBe('idle');
    expect(api.upload).not.toHaveBeenCalled();
    expect((await loadDriveState()).fileId).toBe('f1');
  });

  async function linked() {
    localWithData();
    api.findFile.mockResolvedValue(null);
    await connect();
    api.upload.mockClear();
  }

  it('sync with version mismatch opens conflict', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('9'));
    api.download.mockResolvedValue(remoteJson(withPub('d1', 'Other device')));
    await syncNow();
    expect(drive.status).toBe('conflict');
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('sync with matching version uploads over the file', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('2'));
    api.upload.mockResolvedValue(meta('3'));
    await syncNow();
    expect(api.upload.mock.calls[0][1].id).toBe('f1');
    expect((await loadDriveState()).version).toBe('3');
  });

  async function conflict() {
    await linked();
    api.getMeta.mockResolvedValue(meta('9'));
    api.download.mockResolvedValue(remoteJson(withPub('d1', 'Other device')));
    await syncNow();
  }

  it('resolve device backs up remote then uploads', async () => {
    await conflict();
    api.upload.mockResolvedValue(meta('10'));
    await resolveConflict('device');
    expect((await listBackups())[0]).toMatchObject({ reason: 'drive conflict' });
    expect((await listBackups())[0].dataset.publications[0].name).toBe('Other device');
    expect(api.upload.mock.calls[0][1]).toMatchObject({ id: 'f1' });
    expect(drive.status).toBe('idle');
    expect((await loadDriveState()).version).toBe('10');
  });

  it('resolve drive replaces local and backup holds previous local', async () => {
    await conflict();
    await resolveConflict('drive');
    await flushSaves();
    expect(app.ds.publications[0].name).toBe('Other device');
    expect((await listBackups())[0].dataset.publications[0].name).toBe('Book A');
    expect(api.upload).not.toHaveBeenCalled();
    expect((await loadDriveState()).version).toBe('9');
  });

  it('auth error sets expired and keeps data; reconnect retries upload', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('2'));
    api.upload.mockRejectedValueOnce(new DriveError('auth'));
    await syncNow();
    expect(drive.status).toBe('expired');
    expect(app.ds.publications[0].name).toBe('Book A');
    api.upload.mockResolvedValue(meta('3'));
    await reconnect();
    expect(drive.status).toBe('idle');
    expect(api.upload).toHaveBeenCalledTimes(2);
  });

  it('expired token is not used', async () => {
    await linked();
    gis.requestToken.mockResolvedValue({ token: 'x', expiresAt: Date.now() - 1 });
    await reconnect();
    api.getMeta.mockClear();
    await syncNow();
    expect(drive.status).toBe('expired');
    expect(api.getMeta).not.toHaveBeenCalled();
  });

  it('network error sets error and keeps data', async () => {
    await linked();
    api.getMeta.mockRejectedValue(new DriveError('network'));
    await syncNow();
    expect(drive.status).toBe('error');
    expect(drive.error).toBeTruthy();
    expect(app.ds.publications[0].name).toBe('Book A');
  });

  it('invalid remote never replaces local', async () => {
    api.findFile.mockResolvedValue(meta('5'));
    for (const body of ['not json', JSON.stringify({ formatVersion: 99 }), '{"formatVersion":1}']) {
      api.download.mockResolvedValue(body);
      await connect();
      expect(drive.status).toBe('error');
      expect(drive.error).toBeTruthy();
      expect(app.ds.datasetId).toBe('d1');
      expect(await listBackups()).toEqual([]);
    }
  });

  it('closed consent popup keeps status off', async () => {
    gis.requestToken.mockRejectedValue(new gis.AuthCancelled('x'));
    await connect();
    expect(drive.status).toBe('off');
    expect(drive.error).toBeTruthy();
  });

  it('token never persisted', async () => {
    localWithData();
    api.findFile.mockResolvedValue(null);
    await connect();
    await flushSaves();
    expect(JSON.stringify(await entries(store))).not.toContain(TOKEN);
  });

  it('syncs never overlap', async () => {
    await linked();
    let running = 0, max = 0;
    api.getMeta.mockImplementation(async () => {
      running++; max = Math.max(max, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return meta('2');
    });
    await Promise.all([syncNow(), syncNow(), syncNow()]);
    expect(max).toBe(1);
  });

  it('reconnect makes one silent request and fails without a fallback popup', async () => {
    await linked();
    gis.requestToken.mockClear();
    gis.requestToken.mockRejectedValue(new gis.AuthCancelled('x'));
    await reconnect();
    expect(gis.requestToken).toHaveBeenCalledOnce();
    expect(gis.requestToken).toHaveBeenCalledWith(false);
    expect(drive.status).toBe('expired');
  });

  it('warmed up connect calls requestToken with no await before it', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid');
    await warmDrive();
    vi.unstubAllEnvs();
    expect(gis.preloadGis).toHaveBeenCalled();
    gis.requestToken.mockClear();
    localWithData();
    api.findFile.mockResolvedValue(null);
    const p = connect();
    expect(gis.requestToken).toHaveBeenCalledOnce();
    await p;
  });

  it('resolve device re-checks the remote version and opens a new conflict', async () => {
    await conflict();
    api.getMeta.mockResolvedValue(meta('11'));
    api.download.mockResolvedValue(remoteJson(withPub('d1', 'Third edit')));
    api.upload.mockClear();
    await resolveConflict('device');
    expect(api.upload).not.toHaveBeenCalled();
    expect(await listBackups()).toEqual([]);
    expect(drive.status).toBe('conflict');
    expect(drive.conflict?.remoteMeta.version).toBe('11');
  });

  it('disconnect mid-upload is not undone by the late write', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('2'));
    let done!: (m: ReturnType<typeof meta>) => void;
    api.upload.mockReturnValue(new Promise((r) => { done = r; }));
    const sync = syncNow();
    await vi.waitFor(() => expect(api.upload).toHaveBeenCalled());
    const off = disconnect();
    done(meta('3'));
    await Promise.all([sync, off]);
    expect((await loadDriveState()).connected).toBe(false);
    expect(drive.status).toBe('off');
  });

  it('sync skips the upload when nothing changed since the last sync', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('2'));
    app.lastSavedAt = '2000-01-01T00:00:00.000Z';
    await syncNow();
    expect(api.upload).not.toHaveBeenCalled();
    expect(drive.status).toBe('idle');
    app.lastSavedAt = '2999-01-01T00:00:00.000Z';
    await syncNow();
    expect(api.upload).toHaveBeenCalledOnce();
  });
});
