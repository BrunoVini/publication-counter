import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { listBackups, loadDriveState } from '../../src/store/persist';
import { app, flushSaves } from '../../src/store/app.svelte';
import { connect, drive, resolveConflict, syncNow } from '../../src/store/sync.svelte';
import { api, setupSync, meta, withPub, localWithData, remoteJson, linked, conflict } from './sync-helpers';

vi.mock('../../src/store/drive/api', async (orig) => ({ ...(await orig<object>()), ...(await import('./sync-helpers')).api }));
vi.mock('../../src/store/drive/gis', async () => (await import('./sync-helpers')).gis);

setupSync();

describe('drive sync', () => {
  it('connect with no remote uploads local', async () => {
    localWithData();
    api.findFile.mockImplementation(async () => null);
    await connect();
    expect(api.upload).toHaveBeenCalledOnce();
    expect(api.upload.mock.calls[0][1]).toMatchObject({ datasetId: 'd1', name: 'pubcount.pubcount', folderId: 'folder' });
    expect(api.upload.mock.calls[0][1].id).toBeUndefined();
    expect(drive.status).toBe('idle');
    expect(await loadDriveState()).toMatchObject({ connected: true, fileId: 'f1', version: '2' });
  });

  it('connect with empty local restores remote', async () => {
    const remote = withPub('d1', 'Remote');
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'd1' ? meta('5') : null));
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
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'd1' ? meta('5') : null));
    api.download.mockResolvedValue(remoteJson(withPub('d1', 'Remote')));
    await connect();
    expect(drive.status).toBe('conflict');
    expect(drive.conflict?.local.publications).toBe(1);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('connect with equal data links the file without uploading', async () => {
    const ds = localWithData();
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'd1' ? meta('5') : null));
    api.download.mockResolvedValue(remoteJson(ds));
    await connect();
    expect(drive.status).toBe('idle');
    expect(api.upload).not.toHaveBeenCalled();
    expect((await loadDriveState()).fileId).toBe('f1');
  });

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

});
