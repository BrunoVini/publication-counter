import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, entries, set } from 'idb-keyval';

const api = vi.hoisted(() => ({
  ensureFolder: vi.fn(), findFile: vi.fn(), findLatestInFolder: vi.fn(), getMeta: vi.fn(), download: vi.fn(), upload: vi.fn(),
  findFolder: vi.fn(), deleteFile: vi.fn(),
}));
const gis = vi.hoisted(() => ({
  requestToken: vi.fn(),
  preloadGis: vi.fn(async () => {}),
  revoke: vi.fn(async () => {}),
  AuthCancelled: class AuthCancelled extends Error {},
}));
vi.mock('../../src/store/drive/api', async (orig) => ({ ...(await orig<object>()), ...api }));
vi.mock('../../src/store/drive/gis', () => gis);

import { clearAll, loadDriveState, saveDriveState, setStore } from '../../src/store/persist';
import { app, flushSaves, wipeDevice } from '../../src/store/app.svelte';
import { connect, deleteDriveBackup, disconnect, drive } from '../../src/store/sync.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { DriveError } from '../../src/store/drive/api';

let n = 0;
let store: ReturnType<typeof createStore>;
const TOKEN = 'tok';

beforeEach(async () => {
  vi.clearAllMocks();
  store = createStore(`del${n++}`, 'kv');
  setStore(store);
  await disconnect();
  app.ds = emptyDataset('d1');
  gis.requestToken.mockResolvedValue({ token: TOKEN, expiresAt: Date.now() + 3_600_000 });
  api.ensureFolder.mockResolvedValue('folder');
  api.upload.mockResolvedValue({ id: 'f1', version: '1', modifiedTime: 't' });
  api.findLatestInFolder.mockResolvedValue(null);
  api.findFile.mockResolvedValue(null);
  api.findFolder.mockResolvedValue('folder');
  api.deleteFile.mockResolvedValue(undefined);
});

describe('clearAll', () => {
  it('empties the store', async () => {
    await set('dataset', { a: 1 }, store);
    await set('drive', { connected: true }, store);
    await clearAll();
    expect(await entries(store)).toEqual([]);
  });
});

describe('wipeDevice', () => {
  it('stops sync, clears the store, then reloads', async () => {
    await connect();
    expect(drive.status).toBe('idle');
    const order: string[] = [];
    await saveDriveState({ connected: true, fileId: 'f1' });
    gis.revoke.mockImplementation(async () => { order.push('revoke'); });
    await wipeDevice(() => { order.push('reload'); });
    expect(order).toEqual(['revoke', 'reload']);
    expect(drive.status).toBe('off');
    expect(await entries(store)).toEqual([]);
  });

  it('does not save after the wipe', async () => {
    const { act } = await import('../../src/store/app.svelte');
    await wipeDevice(() => {});
    act((ds) => { ds.settings.unit = 'kg'; });
    await flushSaves();
    expect(await entries(store)).toEqual([]);
  });

  it('does not reload when clearing fails', async () => {
    const bad = createStore('x', 'kv');
    setStore({ ...bad, } as never);
    const reload = vi.fn();
    await expect(wipeDevice(reload)).rejects.toBeDefined();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('deleteDriveBackup', () => {
  beforeEach(async () => { await connect(); });

  it('deletes the file and the folder, then disconnects and revokes', async () => {
    await deleteDriveBackup();
    expect(api.deleteFile.mock.calls).toEqual([[TOKEN, 'f1'], [TOKEN, 'folder']]);
    expect(drive.status).toBe('off');
    expect(await loadDriveState()).toEqual({ connected: false });
    expect(gis.revoke).toHaveBeenCalledWith(TOKEN);
  });

  it('on an auth error goes to expired and keeps the connection', async () => {
    api.deleteFile.mockRejectedValue(new DriveError('auth'));
    await deleteDriveBackup();
    expect(drive.status).toBe('expired');
    expect((await loadDriveState()).connected).toBe(true);
    expect(gis.revoke).not.toHaveBeenCalled();
  });

  it('on another error shows a message and keeps the connection', async () => {
    api.deleteFile.mockRejectedValue(new DriveError('server'));
    await deleteDriveBackup();
    expect(drive.status).toBe('error');
    expect(drive.error).toBeTruthy();
    expect((await loadDriveState()).connected).toBe(true);
    expect(gis.revoke).not.toHaveBeenCalled();
  });

  it('treats notFound as success', async () => {
    api.deleteFile.mockRejectedValue(new DriveError('notFound'));
    await deleteDriveBackup();
    expect(drive.status).toBe('off');
    expect(gis.revoke).toHaveBeenCalledWith(TOKEN);
  });
});
