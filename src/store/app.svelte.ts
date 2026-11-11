import { detectLang, i18n } from '../i18n/index.svelte';
import { applyTheme } from '../ui/theme';
import { validateDataset } from '../domain/file';
import { emptyDataset } from '../domain/dataset';
import type { Dataset } from '../domain/types';
import { scheduleSync } from './sync.svelte';
import { loadDataset, pushBackup, requestPersistentStorage, saveDataset } from './persist';

export const app = $state({
  ds: emptyDataset('pending'),
  saveState: 'saved' as 'saved' | 'saving' | 'unavailable',
  tab: 'count' as 'count' | 'publications' | 'settings',
  openItemId: null as string | null,
  // NOTE: set by first run's "Paste list"; the publications tab consumes it to open the paste dialog.
  pasteOpen: false,
  // NOTE: set by the Summary button and by history rows; the Summary screen consumes it.
  summaryCountId: null as string | null,
  // NOTE: set by "Create '<text>'" in the count search; the publications tab consumes it.
  pubDraftName: null as string | null,
  // NOTE: the count list's "only not counted" filter; the Summary sets it to jump to the uncounted items.
  onlyNotCounted: false,
  // NOTE: text of a file received by launch or share, waiting for the user to confirm replacing data.
  incomingFile: null as string | null,
  // NOTE: ISO time of the last successful save in this session; null until something is saved.
  lastSavedAt: null as string | null,
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
    else {
      app.lastSavedAt = new Date().toISOString();
      if (pending === 0) app.saveState = 'saved';
      scheduleSync();
    }
  });
}

/** Test hook: resolves once every queued save has finished. */
export const flushSaves = async (): Promise<void> => { await chain; };

export async function init(): Promise<void> {
  let ds: Dataset | null = null;
  readFailed = false;
  app.lastSavedAt = null;
  try { ds = await loadDataset(); } catch { readFailed = true; app.saveState = 'unavailable'; }
  app.ds = ds ?? emptyDataset(crypto.randomUUID());
  if (!ds && !readFailed) save();
  void requestPersistentStorage();
  await flushSaves();
}

export function act<T>(fn: (ds: Dataset) => T): T {
  // NOTE: transactional: any throw or schema-invalid result restores the snapshot, so memory
  // never holds data the file schema would reject on the next launch.
  const before = $state.snapshot(app.ds) as Dataset;
  const restore = () => { app.ds = before; };
  let result: T;
  try { result = fn(app.ds); } catch (e) { restore(); throw e; }
  if (!validateDataset($state.snapshot(app.ds))) { restore(); throw new Error('invalidData'); }
  save();
  return result;
}

// NOTE: language and theme live in the dataset, so a replaced dataset must re-apply them.
function applyPreferences(ds: Dataset): void {
  i18n.lang = ds.settings.language ?? detectLang(typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []);
  if (typeof document !== 'undefined') document.documentElement.lang = i18n.lang;
  applyTheme(ds.settings.theme);
}

export async function replaceDataset(next: Dataset, reason: string): Promise<void> {
  const snap = $state.snapshot(app.ds) as Dataset;
  if (!(await enqueue(() => pushBackup(snap, reason)))) throw 'backupFailed';
  app.ds = next;
  applyPreferences(next);
  save();
  await flushSaves();
}
