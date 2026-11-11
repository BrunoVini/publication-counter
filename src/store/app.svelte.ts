import { detectLang, setLang } from '../i18n/index.svelte';
import { applyTheme } from '../ui/theme';
import { validateDataset } from '../domain/file';
import { emptyDataset } from '../domain/dataset';
import type { Dataset } from '../domain/types';
import { disconnect, scheduleSync } from './sync.svelte';
import { clearAll, loadDataset, pushBackup, requestPersistentStorage, saveDataset } from './persist';

interface AppState {
  ds: Dataset;
  saveState: 'saved' | 'saving' | 'unavailable';
  tab: 'count' | 'publications' | 'settings';
  openItemId: string | null;
  pasteOpen: boolean;
  summaryCountId: string | null;
  pubDraftName: string | null;
  onlyNotCounted: boolean;
  incomingFile: string | null;
  lastSavedAt: string | null;
}

export const app = $state<AppState>({
  ds: emptyDataset('pending'),
  saveState: 'saved',
  tab: 'count',
  openItemId: null,
  // NOTE: set by first run's "Paste list"; the publications tab consumes it to open the paste dialog.
  pasteOpen: false,
  // NOTE: set by the Summary button and by history rows; the Summary screen consumes it.
  summaryCountId: null,
  // NOTE: set by "Create '<text>'" in the count search; the publications tab consumes it.
  pubDraftName: null,
  // NOTE: the count list's "only not counted" filter; the Summary sets it to jump to the uncounted items.
  onlyNotCounted: false,
  // NOTE: text of a file received by launch or share, waiting for the user to confirm replacing data.
  incomingFile: null,
  // NOTE: ISO time of the last successful save in this session; null until something is saved.
  lastSavedAt: null,
});

let chain: Promise<unknown> = Promise.resolve();
let pending = 0;
// NOTE: set when the stored value could not be read; saving then would overwrite it.
let readFailed = false;
// NOTE: set once the device is being wiped, so no later save can write the old data back.
let wiping = false;

const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = chain.then(job);
  chain = run.catch(() => undefined);
  return run;
};

function save(): void {
  if (readFailed || wiping) return;
  pending++;
  app.saveState = 'saving';
  // $state.snapshot unwraps the proxy; taken now so each write holds its own state.
  const snap = $state.snapshot(app.ds);
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
  wiping = false;
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
  const before = $state.snapshot(app.ds);
  const restore = () => { app.ds = before; };
  let result: T;
  try { result = fn(app.ds); } catch (e) { restore(); throw e; }
  if (!validateDataset($state.snapshot(app.ds))) { restore(); throw new Error('invalidData'); }
  save();
  return result;
}

// NOTE: language and theme live in the dataset, so a replaced dataset must re-apply them.
async function applyPreferences(ds: Dataset): Promise<void> {
  await setLang(ds.settings.language ?? detectLang(typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []));
  applyTheme(ds.settings.theme);
}

export async function replaceDataset(next: Dataset, reason: string): Promise<void> {
  const snap = $state.snapshot(app.ds);
  if (!(await enqueue(() => pushBackup(snap, reason)))) throw 'backupFailed';
  app.ds = next;
  save();
  await applyPreferences(next);
  await flushSaves();
}

/** Erases everything on this device (the Drive copy is untouched), then calls `reload`. Throws if the store cannot be cleared. */
export async function wipeDevice(reload: () => void = () => location.reload()): Promise<void> {
  wiping = true;
  try {
    await flushSaves();
    await disconnect();
    await clearAll();
  } catch (e) { wiping = false; throw e; }
  reload();
}
