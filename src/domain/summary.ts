import { itemTotal } from './calc';
import { languageName } from './languages.svelte';
import type { Dataset, Lang } from './types';

export interface SummaryRow {
  publicationId: string; name: string; language: string; variant: string;
  units: number | null; previous: number | null; bigChange: boolean; entered: boolean;
  /** True when the item's data is invalid, so no total could be computed. */
  attention: boolean;
}

export const BIG_CHANGE = 0.5;

// NOTE: itemTotal throws on bad data; one bad item must not break the whole summary.
function safeUnits(item: Parameters<typeof itemTotal>[0], scale: Parameters<typeof itemTotal>[1]): { units: number | null; bad: boolean } {
  try { return { units: itemTotal(item, scale)?.units ?? null, bad: false }; } catch { return { units: null, bad: true }; }
}

/** `language` on each row is the displayed name in `lang`; rows are grouped and sorted by it. */
export function summaryRows(ds: Dataset, countId: string, lang: Lang = 'en'): SummaryRow[] {
  const count = ds.counts.find((c) => c.id === countId);
  if (!count) throw new Error('notFound');
  const scale = ds.settings.scale;
  // NOTE: ISO timestamps compare correctly as strings.
  const prev = ds.counts
    .filter((c) => c.finishedAt && c.id !== count.id && c.startedAt < count.startedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  const rows = count.items.map((item): SummaryRow => {
    const pub = ds.publications.find((p) => p.id === item.publicationId) ?? item.snapshot;
    const { units, bad } = safeUnits(item, scale);
    const prevItem = prev?.items.find((i) => i.publicationId === item.publicationId);
    const previous = prevItem ? safeUnits(prevItem, scale).units : null;
    const bigChange = units !== null && previous !== null && previous > 0
      && Math.abs(units - previous) / previous > BIG_CHANGE;
    return {
      publicationId: item.publicationId, name: pub?.name ?? '', language: languageName(pub?.language ?? '', lang),
      variant: pub?.variant ?? '', units, previous, bigChange, entered: item.entered, attention: bad,
    };
  });
  return rows.sort((a, b) =>
    a.language.localeCompare(b.language) || a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant));
}
