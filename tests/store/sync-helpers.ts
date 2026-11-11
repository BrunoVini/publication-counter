import { beforeEach, vi } from 'vitest';
import { createStore } from 'idb-keyval';
import { setStore } from '../../src/store/persist';
import { app } from '../../src/store/app.svelte';
import { connect, disconnect, syncNow } from '../../src/store/sync.svelte';
import { addPublication, emptyDataset } from '../../src/domain/dataset';
import { serializeDataset } from '../../src/domain/file';

// NOTE: shared by every sync test file; each file registers the module mocks with these objects.
export const api = {
  ensureFolder: vi.fn(), findFile: vi.fn(), findLatestInFolder: vi.fn(), getMeta: vi.fn(), download: vi.fn(), upload: vi.fn(),
};
export const gis = {
  requestToken: vi.fn(),
  preloadGis: vi.fn(async () => {}),
  revoke: vi.fn(async () => {}),
  AuthCancelled: class AuthCancelled extends Error {},
};

export const TOKEN = 'secret-token-123';
export const meta = (version: string) => ({ id: 'f1', version, modifiedTime: '2026-01-01T00:00:00Z' });
export const withPub = (id: string, name: string) => {
  const ds = emptyDataset(id);
  addPublication(ds, { name, language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p-' + name);
  return ds;
};
let n = 0;
export let store: ReturnType<typeof createStore>;

export function setupSync(): void {
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
    api.findLatestInFolder.mockResolvedValue(null);
  });
}

export const localWithData = () => { app.ds = withPub('d1', 'Book A'); return JSON.parse(JSON.stringify(app.ds)); };
export const remoteJson = (ds: unknown) => serializeDataset(ds as never);

/** Connects with local data and no remote, leaving the app linked to Drive. */
export async function linked() {
  localWithData();
  api.findFile.mockImplementation(async () => null);
  await connect();
  api.upload.mockClear();
}

/** Links, then syncs against a remote on another version so a conflict opens. */
export async function conflict() {
  await linked();
  api.getMeta.mockResolvedValue(meta('9'));
  api.download.mockResolvedValue(remoteJson(withPub('d1', 'Other device')));
  await syncNow();
}
