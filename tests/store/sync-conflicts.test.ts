import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { listBackups, loadDriveState } from '../../src/store/persist';
import { app, flushSaves } from '../../src/store/app.svelte';
import { connect, disconnect, drive, initDrive, resolveConflict, syncNow } from '../../src/store/sync.svelte';
import { api, gis, setupSync, TOKEN, meta, withPub, localWithData, remoteJson, linked, conflict } from './sync-helpers';

vi.mock('../../src/store/drive/api', async (orig) => ({ ...(await orig<object>()), ...(await import('./sync-helpers')).api }));
vi.mock('../../src/store/drive/gis', async () => (await import('./sync-helpers')).gis);

setupSync();

describe('drive sync', () => {
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

  it('fresh device with another datasetId restores the folder backup when local is empty', async () => {
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'remote-id' ? meta('5') : null));
    api.findLatestInFolder.mockResolvedValue(meta('5'));
    api.download.mockResolvedValue(remoteJson(withPub('remote-id', 'Remote')));
    await connect();
    await flushSaves();
    expect(api.findLatestInFolder).toHaveBeenCalledWith(TOKEN, 'folder');
    expect(app.ds.datasetId).toBe('remote-id');
    expect(app.ds.publications[0].name).toBe('Remote');
    expect(api.upload).not.toHaveBeenCalled();
    expect((await loadDriveState()).fileId).toBe('f1');
  });

  it('fresh device with another datasetId and local data opens a conflict', async () => {
    localWithData();
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'remote-id' ? meta('5') : null));
    api.findLatestInFolder.mockResolvedValue(meta('5'));
    api.download.mockResolvedValue(remoteJson(withPub('remote-id', 'Remote')));
    await connect();
    expect(drive.status).toBe('conflict');
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('a save during the upload is uploaded by the next sync', async () => {
    await linked();
    api.getMeta.mockResolvedValue(meta('2'));
    app.lastSavedAt = '2999-01-01T00:00:00.000Z';
    let done!: (m: ReturnType<typeof meta>) => void;
    api.upload.mockReturnValueOnce(new Promise((r) => { done = r; }));
    const first = syncNow();
    await vi.waitFor(() => expect(api.upload).toHaveBeenCalled());
    app.lastSavedAt = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 5));
    done(meta('3'));
    await first;
    api.getMeta.mockResolvedValue(meta('3'));
    api.upload.mockResolvedValue(meta('4'));
    await syncNow();
    expect(api.upload).toHaveBeenCalledTimes(2);
  });

  it('initDrive warms Google only when a link is saved', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid');
    await initDrive();
    await Promise.resolve();
    expect(gis.preloadGis).not.toHaveBeenCalled();
    localWithData();
    api.findFile.mockImplementation(async () => null);
    await connect();
    await initDrive();
    await vi.waitFor(() => expect(gis.preloadGis).toHaveBeenCalled());
    vi.unstubAllEnvs();
  });
});
