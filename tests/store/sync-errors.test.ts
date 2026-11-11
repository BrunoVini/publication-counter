import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { entries } from 'idb-keyval';
import { listBackups } from '../../src/store/persist';
import { app, flushSaves } from '../../src/store/app.svelte';
import { connect, drive, warmDrive, reconnect, syncNow } from '../../src/store/sync.svelte';
import { DriveError } from '../../src/store/drive/api';
import { api, gis, setupSync, store, TOKEN, meta, localWithData, linked } from './sync-helpers';

vi.mock('../../src/store/drive/api', async (orig) => ({ ...(await orig<object>()), ...(await import('./sync-helpers')).api }));
vi.mock('../../src/store/drive/gis', async () => (await import('./sync-helpers')).gis);

setupSync();

describe('drive sync', () => {
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
    api.findFile.mockImplementation(async (_t: string, id: string) => (id === 'd1' ? meta('5') : null));
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
    api.findFile.mockImplementation(async () => null);
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
    api.findFile.mockImplementation(async () => null);
    const p = connect();
    expect(gis.requestToken).toHaveBeenCalledOnce();
    await p;
  });

});
