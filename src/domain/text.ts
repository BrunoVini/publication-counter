export interface PublicationIdentity {
  name: string;
  language: string;
  variant: string;
}

/** Accent-, case- and spacing-insensitive form used for every comparison and search. */
export const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Control characters (tab, newline, DEL...) become spaces; the file schema rejects them. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what this strips
export const clean = (s: string): string => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

export function identityKey(p: PublicationIdentity): string {
  return [p.name, p.language, p.variant].map(norm).join('\u0000');
}

/** `resolveLanguage` maps free text from the language column (e.g. a name) to a stored value. */
export function parsePastedList(
  text: string, defaultLanguage: string, resolveLanguage: (s: string) => string = (s) => s,
): PublicationIdentity[] {
  const rows: PublicationIdentity[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const [name = '', language = '', variant = ''] = line.split('\t').map((c) => c.trim());
    if (!name) continue;
    rows.push({ name, language: language ? resolveLanguage(language) : defaultLanguage, variant });
  }
  return rows;
}

/** YYYY-MM-DD from a Date's local fields (never UTC, so late evenings keep their own day). */
export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
