import { emptyDataset } from '../domain/dataset';
import type { Dataset } from '../domain/types';
import { loadDataset, pushBackup, requestPersistentStorage, saveDataset } from './persist';

export const app = $state({
  ds: emptyDataset('pending'),
  saveState: 'saved' as 'saved' | 'saving' | 'unavailable',
  tab: 'count' as 'count' | 'publications' | 'settings',
  openItemId: null as string | null,
});

let chain: Promise<unknown> = Promise.resolve();
let pending = 0;

function save(): void {
  pending++;
  app.saveState = 'saving';
  // $state.snapshot unwraps the proxy; taken now so each write holds its own state.
  const snap = $state.snapshot(app.ds) as Dataset;
  chain = chain.then(() => saveDataset(snap)).then((ok) => {
    pending--;
    if (!ok) app.saveState = 'unavailable';
    else if (pending === 0 && app.saveState === 'saving') app.saveState = 'saved';
  });
}

/** Test hook: resolves once every queued save has finished. */
export const flushSaves = async (): Promise<void> => { await chain; };

export async function init(): Promise<void> {
  let ds: Dataset | null = null;
  try { ds = await loadDataset(); } catch { app.saveState = 'unavailable'; }
  app.ds = ds ?? emptyDataset(crypto.randomUUID());
  if (!ds) save();
  void requestPersistentStorage();
  await flushSaves();
}

export function act<T>(fn: (ds: Dataset) => T): T {
  const result = fn(app.ds); // domain errors propagate; nothing is saved
  save();
  return result;
}

export async function replaceDataset(next: Dataset, reason: string): Promise<void> {
  await pushBackup($state.snapshot(app.ds), reason);
  app.ds = next;
  save();
  await flushSaves();
}
