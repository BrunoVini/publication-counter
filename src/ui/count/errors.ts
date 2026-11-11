import { t } from '../../i18n/index.svelte';

/** Maps a thrown domain error code to a translated message; unknown errors get the generic one. */
export function errorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  const key = `err.${code}`;
  const msg = t(key);
  return msg === key ? t('err.generic') : msg;
}

/** Whole number >= 1, digits only. */
export function parseWhole(s: string): number | null {
  const v = s.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 ? n : null;
}
