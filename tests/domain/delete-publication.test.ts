import { expect, test, vi } from 'vitest';

const writeXlsxFile = vi.fn((_data: unknown[][], _opts?: unknown) => ({ toBlob: async () => new Blob(['x']) }));
vi.mock('write-excel-file/browser', () => ({ default: writeXlsxFile }));
vi.mock('../../src/ui/shared/fileio', () => ({ shareOrDownload: vi.fn(async () => undefined) }));

import {
  addEntry, addPublication, deletePublication, emptyDataset, finishCount, pubLanguageOf, startCount, updatePublication,
} from '../../src/domain/dataset';
import { parseDataset, serializeDataset } from '../../src/domain/file';
import { summaryRows } from '../../src/domain/summary';
import { exportExcel } from '../../src/ui/summary/excel';

const mkId = () => { let n = 0; return () => `id${++n}`; };
const pub = (name: string, extra = {}) => ({ name, language: 'pt', variant: 'V', defaultMode: 'hand' as const, ...extra });

function setup() {
  const newId = mkId();
  const ds = emptyDataset('d');
  const a = addPublication(ds, pub('Alpha'), newId);
  const b = addPublication(ds, pub('Beta'), newId);
  const c1 = startCount(ds, 'x', '2026-01-01T10:00:00Z', newId);
  addEntry(ds, c1.id, a.id, { kind: 'hand', units: 7 }, newId);
  addEntry(ds, c1.id, b.id, { kind: 'hand', units: 3 }, newId);
  finishCount(ds, c1.id, '2026-01-02T10:00:00Z');
  const c2 = startCount(ds, 'x', '2026-02-01T10:00:00Z', newId);
  addEntry(ds, c2.id, a.id, { kind: 'hand', units: 9 }, newId);
  return { ds, newId, a, b, c1, c2 };
}

test('delete stamps a snapshot on finished counts and removes the open item', () => {
  const { ds, a, c1, c2 } = setup();
  deletePublication(ds, a.id);
  expect(ds.publications.map((p) => p.name)).toEqual(['Beta']);
  expect(c1.items.find((i) => i.publicationId === a.id)?.snapshot).toEqual({ name: 'Alpha', language: 'pt', variant: 'V' });
  expect(c2.items.some((i) => i.publicationId === a.id)).toBe(false);
  expect(c1.items.find((i) => i.publicationId !== a.id)?.snapshot).toBeUndefined();
});

test('finished count summary and previous column survive a deletion, and the file round-trips', () => {
  const { ds, a, c1, c2 } = setup();
  deletePublication(ds, a.id);
  const rows = summaryRows(ds, c1.id);
  expect(rows.find((r) => r.publicationId === a.id)).toMatchObject({ name: 'Alpha', variant: 'V', units: 7 });
  expect(summaryRows(ds, c2.id).some((r) => r.name === '')).toBe(false);
  const parsed = parseDataset(serializeDataset(ds));
  expect(parsed.ok).toBe(true);
});

test('excel export keeps the deleted publication row', async () => {
  const { ds, a, c1 } = setup();
  deletePublication(ds, a.id);
  await exportExcel(summaryRows(ds, c1.id), { date: '2026-01-01', counter: 'x' });
  const data = writeXlsxFile.mock.calls[0][0] as unknown[][];
  expect(data.some((r) => r[0] === 'Alpha' && r[3] === 7)).toBe(true);
});

test('an old file without snapshot still parses', () => {
  const { ds } = setup();
  expect(JSON.stringify(ds)).not.toContain('snapshot');
  expect(parseDataset(JSON.stringify(ds)).ok).toBe(true);
});

test('editing the sample persists and an open item without entries follows it', () => {
  const { ds, newId, a, b, c2 } = setup();
  updatePublication(ds, b.id, { sample: { units: 10, weightG: 50 } });
  expect(ds.publications.find((p) => p.id === b.id)?.sample).toEqual({ units: 10, weightG: 50 });
  expect(c2.items.find((i) => i.publicationId === b.id)?.sample).toEqual({ units: 10, weightG: 50 });
  updatePublication(ds, b.id, { sample: undefined });
  expect(c2.items.find((i) => i.publicationId === b.id)?.sample).toBeUndefined();
  // with entries the open count keeps its own sample
  updatePublication(ds, a.id, { sample: { units: 5, weightG: 20 } });
  expect(c2.items.find((i) => i.publicationId === a.id)?.sample).toBeUndefined();
  void newId;
});

test('publication language falls back to the UI language code', () => {
  const ds = emptyDataset('d');
  expect(pubLanguageOf(ds.settings, 'es')).toBe('S');
  expect(pubLanguageOf({ ...ds.settings, pubLanguage: 'E' }, 'pt')).toBe('E');
});
