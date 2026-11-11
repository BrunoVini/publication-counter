import { parseDataset } from '../../domain/file';
import { replaceDataset } from '../../store/app.svelte';

/**
 * Opens the system file picker. Resolves null when the user cancels.
 * NOTE: the `cancel` event on file inputs is not universal (older Safari), so a window
 * focus without a chosen file, after a short delay, also counts as a cancel.
 */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    document.body.appendChild(input);
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(value);
    };
    const onFocus = () => setTimeout(() => { if (!input.files?.length) finish(null); }, 500);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      file.text().then(finish, () => finish(null));
    });
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/** Shares the file through the system sheet when possible, else downloads it. */
export async function shareOrDownload(name: string, text: string, mime: string): Promise<void> {
  const file = new File([text], name, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      // NOTE: any other share failure falls back to a plain download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Parses and, when valid, replaces the current data (backed up first). Callers confirm and show messages. */
export async function openPubcountText(text: string): Promise<'ok' | 'notJson' | 'invalid' | 'tooNew'> {
  const r = parseDataset(text);
  if (!r.ok) return r.error;
  await replaceDataset(r.dataset, 'open file'); // 'backupFailed' propagates to the caller
  return 'ok';
}
