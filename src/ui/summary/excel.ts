import type { SummaryRow } from '../../domain/summary';
import type { Dataset } from '../../domain/types';
import { exportFileName } from '../../domain/file';
import { t } from '../../i18n/index.svelte';
import { shareOrDownload } from '../shared/fileio';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function exportExcel(
  rows: SummaryRow[], meta: { location?: string; date: string; counter: string },
): Promise<void> {
  // NOTE: loaded on demand so the library stays out of the first-load bundle.
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const head = (key: string) => ({ value: t(key), fontWeight: 'bold' as const });
  const data = [
    [[meta.location, meta.date, meta.counter].filter(Boolean).join(' · ')],
    [],
    [head('summary.col.name'), head('summary.col.language'), head('summary.col.variant'), head('summary.col.quantity')],
    // NOTE: not counted (or invalid) rows leave the quantity cell empty.
    ...rows.map((r) => [r.name, r.language, r.variant, r.units === null ? null : Math.round(r.units)]),
  ];
  const blob = await writeXlsxFile(data, { sheet: meta.date }).toBlob();
  // NOTE: exportFileName only reads the location name; reused so both exports are named alike.
  const base = exportFileName({ settings: { locationName: meta.location } } as Dataset, meta.date);
  await shareOrDownload(base.replace(/\.pubcount$/, '.xlsx'), blob, XLSX_MIME);
}
