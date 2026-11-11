import { app, replaceDataset } from './app.svelte';
import { loadDriveState, pushBackup, saveDriveState, type DriveState } from './persist';
import { parseDataset, serializeDataset } from '../domain/file';
import { cachedGis, describeError, fetchRemote, gone, loadApi, loadGis, summary, uploadLocal, warmDrive, type Summary } from './sync-remote';
import type { Dataset } from '../domain/types';
import type { DriveMeta } from './drive/api';
import { t } from '../i18n/index.svelte';

export { warmDrive, type Summary };
export type Conflict = { remote: Dataset; remoteMeta: DriveMeta; local: Summary; remoteSummary: Summary };
export type Status = 'off' | 'idle' | 'syncing' | 'expired' | 'error' | 'conflict' | 'notConfigured';

export const drive = $state<{ status: Status; lastSyncAt: string | null; conflict: Conflict | null; error: string | null }>({
  status: 'off',
  lastSyncAt: null,
  conflict: null,
  error: null,
});

const DEBOUNCE_MS = 20_000;
// NOTE: the access token lives only in this variable; it is never persisted.
let tok: { token: string; expiresAt: number } | null = null;
let st: DriveState = { connected: false };
let timer: ReturnType<typeof setTimeout> | undefined;
let chain: Promise<unknown> = Promise.resolve();

// NOTE: serialises every sync operation; a failed job never blocks the next one.
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = chain.then(job);
  chain = run.catch(() => undefined);
  return run;
};

const valid = () => tok !== null && tok.expiresAt > Date.now();
const local = (): Dataset => $state.snapshot(app.ds);

async function store(meta: DriveMeta, lastSyncAt = new Date().toISOString()): Promise<void> {
  st = { fileId: meta.id, version: meta.version, lastSyncAt, connected: true };
  drive.lastSyncAt = lastSyncAt;
  drive.conflict = null;
  drive.error = null;
  drive.status = 'idle';
  await saveDriveState(st);
}

function fail(e: unknown): void {
  const { auth, key } = describeError(e);
  if (auth) tok = null;
  drive.status = auth ? 'expired' : 'error';
  drive.error = key && t(key);
}

const storeUpload = ({ meta, at }: { meta: DriveMeta; at: string }) => store(meta, at);
const upload = (token: string, id?: string) => uploadLocal(token, local, id);

/** Local and remote both exist: link when equal, otherwise open the conflict. Never uploads. */
async function compare(remote: Dataset, meta: DriveMeta): Promise<void> {
  const at = new Date().toISOString();
  const ds = local();
  // NOTE: the remote went through the schema parser, so local is normalised the same way (key order).
  const norm = parseDataset(serializeDataset(ds));
  if (norm.ok && serializeDataset(norm.dataset) === serializeDataset(remote)) return store(meta, at);
  drive.conflict = {
    remote,
    remoteMeta: meta,
    local: summary(ds, app.lastSavedAt ?? ''),
    remoteSummary: summary(remote, meta.modifiedTime),
  };
  drive.status = 'conflict';
}

async function link(token: string): Promise<void> {
  const api = await loadApi();
  const ds = local();
  // NOTE: a fresh install has its own datasetId, so fall back to the newest backup in the app folder.
  const meta = (await api.findFile(token, ds.datasetId)) ?? (await api.findLatestInFolder(token, await api.ensureFolder(token)));
  if (!meta) return storeUpload(await upload(token));
  const remote = await fetchRemote(token, meta.id);
  if (ds.publications.length === 0) {
    await replaceDataset(remote, 'drive restore');
    return store(meta);
  }
  return compare(remote, meta);
}

async function step(fn: () => Promise<void>): Promise<void> {
  drive.status = 'syncing';
  try { await fn(); } catch (e) { fail(e); }
}

export async function connect(): Promise<void> {
  // NOTE: no await before the token request once warmed up, so the popup keeps the click gesture.
  const gis = cachedGis() ?? await loadGis();
  try {
    tok = await gis.requestToken(true);
  } catch {
    drive.status = 'off';
    drive.error = t('drive.err.cancelled');
    return;
  }
  const token = tok.token;
  st = { ...st, connected: true };
  await enqueue(() => step(async () => {
    await link(token);
    // NOTE: remember the link even when a conflict is pending, so a reload still knows Drive is on.
    if (drive.status === 'conflict') await saveDriveState({ ...st, connected: true });
  }));
}

export function syncNow(): Promise<void> {
  clearTimeout(timer);
  return enqueue(async () => {
    if (!st.connected || drive.status === 'conflict') return;
    if (!valid()) { drive.status = 'expired'; return; }
    const token = tok!.token;
    await step(async () => {
      if (!st.fileId) return link(token);
      const api = await loadApi();
      let meta: DriveMeta;
      try {
        meta = await api.getMeta(token, st.fileId);
      } catch (e) {
        if ((e as { kind?: string })?.kind !== 'notFound') throw e;
        // NOTE: the file was deleted on Drive; recreate it from the local data.
        return storeUpload(await upload(token));
      }
      if (meta.version !== st.version) return compare(await fetchRemote(token, meta.id), meta);
      // NOTE: nothing saved since the last sync and the remote is unchanged: nothing to upload.
      // A null lastSavedAt (after a reload) is unknown, so it keeps uploading.
      if (app.lastSavedAt !== null && st.lastSyncAt && app.lastSavedAt <= st.lastSyncAt) {
        drive.status = 'idle';
        return;
      }
      // NOTE: a change on another device between getMeta and this upload can still be overwritten;
      // accepted, there is no If-Match on the upload.
      return storeUpload(await upload(token, st.fileId));
    });
  });
}

export function resolveConflict(choice: 'device' | 'drive'): Promise<void> {
  return enqueue(async () => {
    const c = drive.conflict;
    if (!c) return;
    if (!valid()) { drive.status = 'expired'; return; }
    const token = tok!.token;
    await step(async () => {
      if (choice === 'drive') {
        await replaceDataset(c.remote, 'drive conflict');
        return store(c.remoteMeta);
      }
      // NOTE: the remote may have moved since the conflict opened; re-check before touching anything.
      const api = await loadApi();
      const now = await api.getMeta(token, c.remoteMeta.id);
      if (now.version !== c.remoteMeta.version) return compare(await fetchRemote(token, now.id), now);
      if (!(await pushBackup(c.remote, 'drive conflict'))) throw 'backupFailed';
      return storeUpload(await upload(token, c.remoteMeta.id));
    });
  });
}

export async function reconnect(): Promise<void> {
  const gis = cachedGis() ?? await loadGis();
  try {
    tok = await gis.requestToken(false);
  } catch (e) {
    // NOTE: one silent attempt only; the next click retries, which keeps every popup inside a gesture.
    const cancelled = e instanceof gis.AuthCancelled;
    drive.status = cancelled ? 'expired' : 'error';
    drive.error = t(cancelled ? 'drive.err.cancelled' : 'drive.err.generic');
    return;
  }
  // NOTE: a pending conflict stays; syncNow skips it until the user chooses.
  if (drive.status !== 'conflict') drive.status = 'idle';
  drive.error = null;
  await syncNow();
}

async function resetLink(): Promise<void> {
  st = { connected: false };
  drive.status = 'off';
  drive.conflict = null;
  drive.error = null;
  drive.lastSyncAt = null;
  await saveDriveState(st);
}

async function revokeBestEffort(old: { token: string } | null): Promise<void> {
  if (old) { try { await (await loadGis()).revoke(old.token); } catch { /* best effort */ } }
}

export async function disconnect(): Promise<void> {
  clearTimeout(timer);
  const old = tok;
  tok = null;
  // NOTE: queued behind any in-flight sync so its late write cannot undo the disconnect.
  await enqueue(resetLink);
  await revokeBestEffort(old);
}

/** Deletes the backup file and the app folder from Drive, then disconnects. Keeps the link on failure so it can be retried. */
export function deleteDriveBackup(): Promise<void> {
  clearTimeout(timer);
  return enqueue(async () => {
    if (!st.connected) return;
    if (!valid()) { drive.status = 'expired'; return; }
    const old = tok!;
    drive.status = 'syncing';
    try {
      const api = await loadApi();
      if (st.fileId) await gone(api.deleteFile(old.token, st.fileId));
      const folder = await api.findFolder(old.token);
      if (folder) await gone(api.deleteFile(old.token, folder));
    } catch (e) { fail(e); return; }
    tok = null;
    await resetLink();
    await revokeBestEffort(old);
  });
}

export function scheduleSync(): void {
  if (!st.connected || !valid()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
}

/** Loads the device Drive link at startup. A saved link without a token shows as expired (Reconnect). */
export async function initDrive(): Promise<void> {
  // NOTE: read here (not via gis.ts) so the Drive chunk is not fetched for users who never connect.
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) { drive.status = 'notConfigured'; return; }
  st = await loadDriveState();
  if (st.connected) void warmDrive();
  drive.lastSyncAt = st.lastSyncAt ?? null;
  drive.status = st.connected ? 'expired' : 'off';
}
