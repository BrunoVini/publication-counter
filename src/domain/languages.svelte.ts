import { i18n } from '../i18n/index.svelte';
import { identityKey, norm, type PublicationIdentity } from './text';
import type { Lang } from './types';

/** One entry of the public languages list: code and vernacular name. */
export interface LanguageEntry { c: string; v: string }

type Names = Record<string, string>;
interface Base { list: LanguageEntry[]; byCode: Map<string, LanguageEntry> }
// NOTE: both are reassigned (never mutated) when something loads, so anything displaying a name re-renders then.
const store = $state<{ base: Base | null; names: Partial<Record<Lang, Names>> }>({ base: null, names: {} });
// Non-reactive lookups derived from what is loaded: normalised name -> code, and per-language normalised search text.
const exact = new Map<string, string>();
const haystack: Partial<Record<Lang, Map<string, string>>> = {};
const inflight = new Map<string, Promise<unknown>>();
const nameLoaders = import.meta.glob<{ default: Names }>('../data/language-names/*.json');
let watching = false;

const once = <T>(key: string, run: () => Promise<T>): Promise<T> => {
  if (!inflight.has(key)) inflight.set(key, run().catch((e) => { inflight.delete(key); throw e; }));
  return inflight.get(key) as Promise<T>;
};
const claim = (name: string, code: string) => { const k = norm(name); if (k && !exact.has(k)) exact.set(k, code); };

async function loadBase(): Promise<void> {
  if (store.base) return;
  const list = (await import('../data/languages.json')).default as LanguageEntry[];
  for (const e of list) claim(e.v, e.c);
  store.base = { list, byCode: new Map(list.map((e) => [e.c, e])) };
}

async function loadNames(lang: Lang): Promise<void> {
  if (store.names[lang]) return;
  const names = (await nameLoaders[`../data/language-names/${lang}.json`]()).default;
  for (const [c, n] of Object.entries(names)) claim(n, c);
  haystack[lang] = new Map(Object.entries(names).map(([c, n]) => [c, norm(n)]));
  store.names = { ...store.names, [lang]: names };
}

/** Lazy-imports the list and the names of the current UI language (plus English, the fallback) so they stay out of the first-load chunk. */
export async function loadLanguages(): Promise<LanguageEntry[]> {
  if (!watching) {
    watching = true;
    // NOTE: follows the UI language, loading its names when it changes.
    $effect.root(() => { $effect(() => { void once(`names:${i18n.lang}`, () => loadNames(i18n.lang)); }); });
  }
  await Promise.all([once('base', loadBase), once('names:en', () => loadNames('en')), once(`names:${i18n.lang}`, () => loadNames(i18n.lang))]);
  return store.base!.list;
}

export const languagesLoaded = (): boolean => store.base !== null;
export const languageEntry = (code: string): LanguageEntry | undefined => store.base?.byCode.get(code);

/** Name in the current UI language, else English, else the vernacular name; legacy free text and unknown codes come back unchanged. */
export function languageName(code: string): string {
  const e = languageEntry(code);
  return e ? (store.names[i18n.lang]?.[code] ?? store.names.en?.[code] ?? (e.v || code)) : code;
}

/** Free text from a pasted column to a code, only on an exact (normalised) match with a loaded name. */
export function languageByName(text: string): string {
  const q = norm(text);
  return (q && store.base && exact.get(q)) || text;
}

/** Identity key on a canonical language, so legacy free text and codes compare equal once the list is loaded. */
export const canonicalKey = (p: PublicationIdentity): string => identityKey({ ...p, language: languageByName(p.language) });

/** Entries whose localised, vernacular or English name, or code, contain the query; an empty query matches everything. */
export function searchLanguages(query: string): LanguageEntry[] {
  const b = store.base;
  if (!b) return [];
  const q = norm(query);
  if (!q) return b.list;
  void store.names; // NOTE: tracked so the result refreshes when more names arrive.
  const local = haystack[i18n.lang];
  const en = haystack.en;
  return b.list.filter((e) => norm(e.c).includes(q) || norm(e.v).includes(q) || local?.get(e.c)?.includes(q) || en?.get(e.c)?.includes(q));
}
