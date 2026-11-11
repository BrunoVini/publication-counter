export interface PublicationIdentity {
  name: string;
  language: string;
  variant: string;
}

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function identityKey(p: PublicationIdentity): string {
  return [p.name, p.language, p.variant].map(norm).join('\u0000');
}

export function parsePastedList(text: string, defaultLanguage: string): PublicationIdentity[] {
  const rows: PublicationIdentity[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [name = '', language = '', variant = ''] = line.split('\t').map((c) => c.trim());
    if (!name) continue;
    rows.push({ name, language: language || defaultLanguage, variant });
  }
  return rows;
}

/** YYYY-MM-DD from a Date's local fields (never UTC, so late evenings keep their own day). */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
