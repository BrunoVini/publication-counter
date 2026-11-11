import { emptyDataset } from '../domain/dataset';
import type { Dataset } from '../domain/types';
import { loadDataset, pushBackup, requestPersistentStorage, saveDataset } from './persist';

export const app = $state({
  ds: emptyDataset('pending'),
  saveState: 'saved' as 'saved' | 'saving' | 'unavailable',
  tab: 'count' as 'count' | 'publications' | 'settings',
  openItemId: null as string | null,
  // NOTE: set by first run's "Paste list"; the publications tab consumes it to open the paste dialog.
  pasteOpen: false,
});

let chain: Promise<unknown> = Promise.resolve();
let pending = 0;
// NOTE: set when the stored value could not be read; saving then would overwrite it.
let readFailed = false;

const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = chain.then(job);
  chain = run.catch(() => undefined);
  return run;
};

function save(): void {
  if (readFailed) return;
  pending++;
  app.saveState = 'saving';
  // $state.snapshot unwraps the proxy; taken now so each write holds its own state.
  const snap = $state.snapshot(app.ds) as Dataset;
  void enqueue(() => saveDataset(snap)).then((ok) => {
    pending--;
    if (!ok) app.saveState = 'unavailable';
    else if (pending === 0) app.saveState = 'saved';
  });
}

/** Test hook: resolves once every queued save has finished. */
export const flushSaves = async (): Promise<void> => { await chain; };

export async function init(): Promise<void> {
  let ds: Dataset | null = null;
  readFailed = false;
  try { ds = await loadDataset(); } catch { readFailed = true; app.saveState = 'unavailable'; }
  app.ds = ds ?? emptyDataset(crypto.randomUUID());
  if (!ds && !readFailed) save();
  void requestPersistentStorage();
  await flushSaves();
}

export function act<T>(fn: (ds: Dataset) => T): T {
  const result = fn(app.ds); // domain errors propagate; nothing is saved
  save();
  return result;
}

export async function replaceDataset(next: Dataset, reason: string): Promise<void> {
  const snap = $state.snapshot(app.ds) as Dataset;
  if (!(await enqueue(() => pushBackup(snap, reason)))) throw 'backupFailed';
  app.ds = next;
  save();
  await flushSaves();
}
