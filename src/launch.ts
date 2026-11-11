import { app } from './store/app.svelte';
import { watchOpenCount } from './store/watch.svelte';
import { parseDataset } from './domain/file';
import { openPubcountText } from './ui/shared/fileio';
import { showToast } from './ui/shared/Toast.svelte';
import { t } from './i18n/index.svelte';

export const SHARE_CACHE = 'pubcount-shared';
export const SHARED_KEY = '/shared-file';

/** Opens the pending incoming file (after the user confirmed, or when there is no data to lose). */
export async function applyIncoming(text: string): Promise<void> {
  try {
    const r = await openPubcountText(text);
    showToast(t(r === 'ok' ? 'set.openDone' : `set.err.${r}`));
  } catch (e) {
    showToast(t(e === 'backupFailed' ? 'set.err.backupFailed' : 'set.err.invalid'));
  }
}

/** Entry point for files that arrive from outside: invalid ones change nothing, existing data needs confirmation. */
export async function handleIncoming(text: string): Promise<void> {
  const parsed = parseDataset(text);
  if (!parsed.ok) { showToast(t(`set.err.${parsed.error}`)); return; }
  if (app.ds.publications.length > 0) { app.incomingFile = text; return; }
  await applyIncoming(text);
}

/** Share target: the service worker cached the posted file and redirected to /?shared=1. */
export async function handleSharedFile(): Promise<void> {
  if (new URLSearchParams(location.search).get('shared') !== '1') return;
  history.replaceState(null, '', location.pathname);
  try {
    const cache = await caches.open(SHARE_CACHE);
    const res = await cache.match(SHARED_KEY);
    if (!res) return;
    const text = await res.text();
    await cache.delete(SHARED_KEY);
    await handleIncoming(text);
  } catch {
    showToast(t('set.err.invalid'));
  }
}

type LaunchParams = { files: { getFile(): Promise<File> }[] };

/** File handler: double-clicking a .pubcount file in the installed app. */
export function setupLaunchQueue(): void {
  const lq = (window as unknown as { launchQueue?: { setConsumer(fn: (p: LaunchParams) => void | Promise<void>): void } }).launchQueue;
  lq?.setConsumer(async (p) => {
    const f = await p.files[0]?.getFile();
    if (f) await handleIncoming(await f.text());
  });
}

/** Keeps the screen awake while a count is open. Returns a stop function. */
export function setupWakeLock(): () => void {
  if (!navigator.wakeLock) return () => undefined;
  let lock: WakeLockSentinel | null = null;
  let want = false;
  const acquire = async () => {
    if (!want || lock) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch { /* NOTE: a refused lock is silent. */ }
    // The lock may have been released while the request was pending.
    if (!want && lock) { void lock.release().catch(() => undefined); lock = null; }
  };
  const release = () => { const l = lock; lock = null; void l?.release().catch(() => undefined); };
  // NOTE: the browser drops the lock when the page is hidden, so it is requested again on return.
  const onVisible = () => { if (document.visibilityState === 'visible') { lock = null; void acquire(); } };
  document.addEventListener('visibilitychange', onVisible);
  const stop = watchOpenCount((open) => { want = open; if (open) void acquire(); else release(); });
  return () => { stop(); document.removeEventListener('visibilitychange', onVisible); release(); };
}
