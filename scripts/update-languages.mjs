// Regenerates src/data/languages.json from the public languages list (Node 22, no dependencies).
import { writeFile } from 'node:fs/promises';

const UI = ['pt', 'en', 'es'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const out = new URL('../src/data/languages.json', import.meta.url);

async function load(l) {
  const res = await fetch(`https://www.jw.org/${l}/languages/`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${l}: HTTP ${res.status}`);
  const { languages } = await res.json();
  if (!Array.isArray(languages) || languages.length < 500) throw new Error(`${l}: unexpected payload`);
  // NOTE: never trust the payload's shape; a malformed entry is skipped, and too few valid ones aborts.
  const ok = languages.filter((x) => x && typeof x.langcode === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(x.langcode)
    && typeof x.name === 'string' && typeof x.vernacularName === 'string');
  if (ok.length < 500) throw new Error(`${l}: only ${ok.length} valid entries`);
  return ok;
}

const byCode = new Map();
for (const l of UI) {
  for (const x of await load(l)) {
    const e = byCode.get(x.langcode) ?? { c: x.langcode };
    e[l] = x.name;
    if (l === 'en' || !e.v) e.v = x.vernacularName;
    byCode.set(x.langcode, e);
  }
}
const list = [...byCode.values()]
  .map((e) => ({ c: e.c, pt: e.pt ?? e.en ?? e.c, en: e.en ?? e.pt ?? e.c, es: e.es ?? e.en ?? e.c, v: e.v ?? '' }))
  .sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
await writeFile(out, JSON.stringify(list) + '\n');
console.log(`wrote ${list.length} languages`);
