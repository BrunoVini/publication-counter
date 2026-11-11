// Regenerates src/data/languages.json ({c, v}) and src/data/language-names/<lang>.json ({code: name})
// from the public languages list (Node 22, no dependencies).
import { mkdir, writeFile } from 'node:fs/promises';

// UI language -> URL path segment. NOTE: the path is not always the UI tag (Simplified Chinese is cmn-hans).
const PATHS = {
  pt: 'pt', en: 'en', es: 'es', zh: 'cmn-hans', hi: 'hi', fr: 'fr', ar: 'ar', bn: 'bn',
  ru: 'ru', ur: 'ur', id: 'id', de: 'de', ja: 'ja', tr: 'tr', mr: 'mr',
};
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const data = new URL('../src/data/', import.meta.url);

async function load(lang) {
  const res = await fetch(`https://www.jw.org/${PATHS[lang]}/languages/`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${lang}: HTTP ${res.status}`);
  const { languages } = await res.json();
  if (!Array.isArray(languages) || languages.length < 500) throw new Error(`${lang}: unexpected payload`);
  // NOTE: never trust the payload's shape; a malformed entry is skipped, and too few valid ones aborts.
  const ok = languages.filter((x) => x && typeof x.langcode === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(x.langcode)
    && typeof x.name === 'string' && x.name.trim() !== '' && typeof x.vernacularName === 'string');
  if (ok.length < 500) throw new Error(`${lang}: only ${ok.length} valid entries`);
  return ok;
}

const byCode = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
const names = {};
const vernacular = new Map();
// NOTE: everything is fetched before anything is written, so a failed locale never leaves a partial result.
for (const lang of Object.keys(PATHS)) {
  const list = await load(lang);
  names[lang] = Object.fromEntries(list.map((x) => [x.langcode, x.name]).sort(byCode));
  // The vernacular name does not depend on the page language; the English list is the reference.
  if (lang === 'en') for (const x of list) vernacular.set(x.langcode, x.vernacularName);
}
const base = [...vernacular].sort(byCode).map(([c, v]) => ({ c, v }));
await mkdir(new URL('language-names/', data), { recursive: true });
for (const [lang, map] of Object.entries(names)) await writeFile(new URL(`language-names/${lang}.json`, data), JSON.stringify(map) + '\n');
await writeFile(new URL('languages.json', data), JSON.stringify(base) + '\n');
console.log(`wrote ${base.length} languages and ${Object.keys(names).length} name files`);
