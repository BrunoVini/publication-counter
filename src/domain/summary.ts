import { itemTotal } from './calc';
import type { Dataset } from './types';

export interface SummaryRow {
  publicationId: string; name: string; language: string; variant: string;
  units: number | null; previous: number | null; bigChange: boolean; entered: boolean;
}

export const BIG_CHANGE = 0.5;

export function summaryRows(ds: Dataset, countId: string): SummaryRow[] {
  const count = ds.counts.find((c) => c.id === countId);
  if (!count) throw new Error('notFound');
  const scale = ds.settings.scale;
  // NOTE: ISO timestamps compare correctly as strings.
  const prev = ds.counts
    .filter((c) => c.finishedAt && c.id !== count.id && c.startedAt < count.startedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  const rows = count.items.map((item): SummaryRow => {
    const pub = ds.publications.find((p) => p.id === item.publicationId);
    const units = itemTotal(item, scale)?.units ?? null;
    const prevItem = prev?.items.find((i) => i.publicationId === item.publicationId);
    const previous = prevItem ? itemTotal(prevItem, scale)?.units ?? null : null;
    const bigChange = units !== null && previous !== null && previous > 0
      && Math.abs(units - previous) / previous > BIG_CHANGE;
    return {
      publicationId: item.publicationId, name: pub?.name ?? '', language: pub?.language ?? '',
      variant: pub?.variant ?? '', units, previous, bigChange, entered: item.entered,
    };
  });
  return rows.sort((a, b) =>
    a.language.localeCompare(b.language) || a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant));
}
