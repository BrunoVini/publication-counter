import { expect, test } from 'vitest';
import { addEntry, addPublication, emptyDataset, finishCount, startCount } from '../../src/domain/dataset';
import { summaryRows } from '../../src/domain/summary';

const mkId = () => { let n = 0; return () => `id${++n}`; };
const pub = (name: string, language = 'pt') => ({ name, language, variant: '', defaultMode: 'hand' as const });

test('summary previous and bigChange', () => {
  const newId = mkId();
  const ds = emptyDataset('d');
  const a = addPublication(ds, pub('A'), newId);
  const b = addPublication(ds, pub('B'), newId);
  const c1 = startCount(ds, 'x', '2026-01-01', newId);
  addEntry(ds, c1.id, a.id, { kind: 'hand', units: 181 }, newId);
  addEntry(ds, c1.id, b.id, { kind: 'hand', units: 540 }, newId);
  finishCount(ds, c1.id, '2026-01-02');
  const c2 = startCount(ds, 'x', '2026-02-01', newId);
  addEntry(ds, c2.id, a.id, { kind: 'hand', units: 18 }, newId);
  addEntry(ds, c2.id, b.id, { kind: 'hand', units: 561 }, newId);
  const rows = summaryRows(ds, c2.id);
  expect(rows.find((r) => r.publicationId === a.id)).toMatchObject({ units: 18, previous: 181, bigChange: true });
  expect(rows.find((r) => r.publicationId === b.id)).toMatchObject({ units: 561, previous: 540, bigChange: false });
  const first = summaryRows(ds, c1.id);
  expect(first.every((r) => r.previous === null && !r.bigChange)).toBe(true);
});

test('summary uncounted is null and sorted by language then name', () => {
  const newId = mkId();
  const ds = emptyDataset('d');
  addPublication(ds, pub('Zeta', 'en'), newId);
  addPublication(ds, pub('Beta', 'pt'), newId);
  addPublication(ds, pub('Alpha', 'pt'), newId);
  const c = startCount(ds, 'x', 't', newId);
  const rows = summaryRows(ds, c.id);
  expect(rows.map((r) => r.name)).toEqual(['Zeta', 'Alpha', 'Beta']);
  expect(rows.every((r) => r.units === null && !r.entered)).toBe(true);
});

test('summary sorts by variant on ties and previous is null when earlier count lacks the item', () => {
  const newId = mkId();
  const ds = emptyDataset('d');
  const v2 = addPublication(ds, { ...pub('Same'), variant: 'b' }, newId);
  addPublication(ds, { ...pub('Same'), variant: 'a' }, newId);
  const c1 = startCount(ds, 'x', '2026-01-01', newId);
  finishCount(ds, c1.id, '2026-01-02');
  const late = addPublication(ds, pub('Late'), newId);
  const c2 = startCount(ds, 'x', '2026-02-01', newId);
  addEntry(ds, c2.id, late.id, { kind: 'hand', units: 5 }, newId);
  const rows = summaryRows(ds, c2.id);
  expect(rows.filter((r) => r.name === 'Same').map((r) => r.variant)).toEqual(['a', 'b']);
  expect(rows.find((r) => r.publicationId === late.id)).toMatchObject({ previous: null, bigChange: false });
  expect(v2.variant).toBe('b');
});
