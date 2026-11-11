import type { Lang } from '../domain/types';
import pt from './pt.json';
import en from './en.json';
import es from './es.json';

type Dict = Record<string, string>;
const dicts: Record<Lang, Dict> = { pt, en, es };
const locales: Record<Lang, string> = { pt: 'pt-BR', en: 'en', es: 'es' };

export function detectLang(navigatorLanguages: readonly string[]): Lang {
  for (const tag of navigatorLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'pt' || base === 'en' || base === 'es') return base;
  }
  return 'en';
}

export const i18n = $state<{ lang: Lang }>({
  lang: detectLang(typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []),
});

function lookup(lang: Lang, key: string, count?: number): string | undefined {
  const d = dicts[lang];
  if (count !== undefined) {
    const form = new Intl.PluralRules(locales[lang]).select(count);
    return d[`${key}_${form}`] ?? d[`${key}_other`] ?? d[key];
  }
  return d[key];
}

export function t(key: string, params?: Record<string, string | number>): string {
  const count = typeof params?.count === 'number' ? params.count : undefined;
  const text = lookup(i18n.lang, key, count) ?? lookup('en', key, count) ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (params && name in params ? String(params[name]) : m));
}

export function fmtNumber(n: number, maxFractionDigits = 3): string {
  return new Intl.NumberFormat(locales[i18n.lang], { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })}`;
}

export function fmtDate(iso: string): string {
  try {
    // NOTE: date-only strings parse as UTC midnight, so format in UTC to avoid a one-day shift.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locales[i18n.lang], dateOnly ? { timeZone: 'UTC' } : undefined).format(d);
  } catch {
    return iso;
  }
}
