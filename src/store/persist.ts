import { createStore, get, set, type UseStore } from 'idb-keyval';
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

export async function pushBackup(ds: unknown, reason: string): Promise<void> {
  try {
    const next = [{ savedAt: new Date().toISOString(), reason, dataset: ds as Dataset },
      ...(await listBackups())].slice(0, MAX_BACKUPS);
    await set('backups', JSON.parse(JSON.stringify(next)), kv());
  } catch { /* NOTE: a failed backup must never block the caller */ }
}

export async function loadDataset(): Promise<Dataset | null> {
  const raw = await get<unknown>('dataset', kv());
  if (raw == null) return null;
  const r = parseDataset(JSON.stringify(raw));
  if (r.ok) return r.dataset;
  await pushBackup(raw, 'corrupt');
  return null;
}

export async function saveDataset(ds: Dataset): Promise<boolean> {
  try { await set('dataset', ds, kv()); return true; } catch { return false; }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
