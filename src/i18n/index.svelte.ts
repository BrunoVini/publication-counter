import { LANGS, type Lang } from '../domain/types';
import en from './en.json';

type Dict = Record<string, string>;
// NOTE: only `en` (the fallback) is bundled; every other locale is a separate chunk loaded on demand.
const dicts: Partial<Record<Lang, Dict>> = { en };
const loaders = import.meta.glob<{ default: Dict }>(['./*.json', '!./en.json']);
const locales: Record<Lang, string> = {
  pt: 'pt-BR', en: 'en', es: 'es', zh: 'zh-CN', hi: 'hi', fr: 'fr', ar: 'ar', bn: 'bn', ru: 'ru', ur: 'ur', id: 'id', de: 'de', ja: 'ja', tr: 'tr', mr: 'mr',
};
const RTL: readonly Lang[] = ['ar', 'ur'];

/** The Intl locale tag of the current UI language. */
export const intlLocale = (): string => locales[i18n.lang];

export function detectLang(navigatorLanguages: readonly string[]): Lang {
  for (const tag of navigatorLanguages) {
    const base = tag.toLowerCase().split('-')[0] as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

export const i18n = $state<{ lang: Lang }>({
  lang: detectLang(typeof navigator !== 'undefined' ? (navigator.languages ?? []) : []),
});

/** Loads a locale chunk (cached; precached by the service worker, so it works offline). */
export async function loadLocale(lang: Lang): Promise<void> {
  if (dicts[lang]) return;
  dicts[lang] = (await loaders[`./${lang}.json`]()).default;
}

/** Loads the locale, then switches to it and mirrors it on the document (lang and text direction). */
export async function setLang(lang: Lang): Promise<void> {
  await loadLocale(lang);
  i18n.lang = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL.includes(lang) ? 'rtl' : 'ltr';
  }
}

// NOTE: tries the exact plural form (_zero/_one/_two/_few/_many/_other), then _other, then the bare key.
function lookup(lang: Lang, key: string, count?: number): string | undefined {
  const d = dicts[lang];
  if (!d) return undefined;
  if (count !== undefined) {
    const form = new Intl.PluralRules(locales[lang]).select(count);
    return d[`${key}_${form}`] ?? d[`${key}_other`] ?? d[key];
  }
  return d[key];
}

export function t(key: string, params?: Record<string, string | number>): string {
  const count = typeof params?.count === 'number' ? params.count : undefined;
  const text = lookup(i18n.lang, key, count) ?? lookup('en', key, count) ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (params && name in params ? String(params[name]) : m));
}

export function fmtNumber(n: number, maxFractionDigits = 3): string {
  return new Intl.NumberFormat(locales[i18n.lang], { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString(locales[i18n.lang], { hour: '2-digit', minute: '2-digit' })}`;
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
