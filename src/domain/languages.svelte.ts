import { identityKey, norm, type PublicationIdentity } from './text';
import type { Lang } from './types';

/** One entry of the public languages list: code, localised names and the vernacular name. */
export interface LanguageEntry { c: string; pt: string; en: string; es: string; v: string }

interface Loaded { list: LanguageEntry[]; byCode: Map<string, LanguageEntry>; index: string[] }
// NOTE: reassigned once when loaded, so anything displaying a name re-renders then.
const store = $state<{ data: Loaded | null }>({ data: null });

/** Lazy-imports the list so its ~100 KB stays out of the first-load bundle. */
export async function loadLanguages(): Promise<LanguageEntry[]> {
  if (!store.data) {
    const list = (await import('../data/languages.json')).default as LanguageEntry[];
    store.data = {
      list,
      byCode: new Map(list.map((e) => [e.c, e])),
      index: list.map((e) => norm(`${e.c} ${e.pt} ${e.en} ${e.es} ${e.v}`)),
    };
  }
  return store.data.list;
}

export const languagesLoaded = (): boolean => store.data !== null;
export const languageEntry = (code: string): LanguageEntry | undefined => store.data?.byCode.get(code);

/** Localised name for a code; legacy free text and unknown codes come back unchanged. */
export const languageName = (code: string, ui: Lang): string => languageEntry(code)?.[ui] ?? code;

/** Free text from a pasted column to a code, only on an exact (normalised) name match. */
export function languageByName(text: string): string {
  const q = norm(text);
  if (!q || !store.data) return text;
  const hit = store.data.list.find((e) => [e.pt, e.en, e.es, e.v].some((n) => norm(n) === q));
  return hit ? hit.c : text;
}

/** Identity key on a canonical language, so legacy free text and codes compare equal once the list is loaded. */
export const canonicalKey = (p: PublicationIdentity): string => identityKey({ ...p, language: languageByName(p.language) });

/** Entries whose names or code contain the query; an empty query matches everything. */
export function searchLanguages(query: string): LanguageEntry[] {
  const d = store.data;
  if (!d) return [];
  const q = norm(query);
  return q ? d.list.filter((_, i) => d.index[i].includes(q)) : d.list;
}
