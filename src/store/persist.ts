import { clear, createStore, get, set, type UseStore } from 'idb-keyval';
import { parseDataset } from '../domain/file';
import type { Dataset } from '../domain/types';

export type Backup = { savedAt: string; reason: string; dataset: Dataset };

const MAX_BACKUPS = 5;
let store: UseStore | undefined;
// NOTE: created lazily so importing this module never touches IndexedDB.
const kv = (): UseStore => (store ??= createStore('pubcount', 'kv'));
export const setStore = (s: UseStore): void => { store = s; };

export async function listBackups(): Promise<Backup[]> {
  try { return (await get<Backup[]>('backups', kv())) ?? []; } catch { return []; }
}

/** Resolves false when the backup could not be written. */
export async function pushBackup(ds: Dataset, reason: string): Promise<boolean> {
  try {
    const next = [{ savedAt: new Date().toISOString(), reason, dataset: ds },
      ...(await get<Backup[]>('backups', kv()) ?? [])].slice(0, MAX_BACKUPS);
    await set('backups', JSON.parse(JSON.stringify(next)), kv());
    return true;
  } catch { return false; }
}

export async function loadDataset(): Promise<Dataset | null> {
  const raw = await get<unknown>('dataset', kv());
  if (raw == null) return null;
  const r = parseDataset(JSON.stringify(raw));
  if (r.ok) return r.dataset;
  // NOTE: single slot, newest overwrites; kept apart so `backups` only holds valid datasets.
  // NOTE: when it cannot be kept, this throws so init stays memory-only instead of overwriting `dataset`.
  await set('corrupt', raw, kv());
  return null;
}

/** The raw value of the last unreadable dataset, if any. */
export async function getCorrupt(): Promise<unknown> {
  try { return await get<unknown>('corrupt', kv()); } catch { return undefined; }
}

export async function saveDataset(ds: Dataset): Promise<boolean> {
  try { await set('dataset', ds, kv()); return true; } catch { return false; }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

// NOTE: device-only Drive link; never part of the dataset and never holds the access token.
export type DriveState = { fileId?: string; version?: string; lastSyncAt?: string; connected: boolean };

export async function loadDriveState(): Promise<DriveState> {
  try { return (await get<DriveState>('drive', kv())) ?? { connected: false }; } catch { return { connected: false }; }
}

export async function saveDriveState(s: DriveState): Promise<boolean> {
  try { await set('drive', s, kv()); return true; } catch { return false; }
}

/** Removes everything this app keeps on the device. Throws when the store cannot be cleared. */
export const clearAll = (): Promise<void> => clear(kv());
