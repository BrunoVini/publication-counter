import { expect, test } from 'vitest';
import { addEntry, addPublication, deletePublication, emptyDataset, finishCount, startCount } from '../../src/domain/dataset';
import { loadLanguages } from '../../src/domain/languages.svelte';
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

test('summary marks an invalid item as attention without breaking the others', () => {
  const newId = mkId();
  const ds = emptyDataset('d');
  const good = addPublication(ds, pub('Good'), newId);
  const bad = addPublication(ds, pub('Bad'), newId);
  const c1 = startCount(ds, 'x', '2026-01-01', newId);
  addEntry(ds, c1.id, good.id, { kind: 'hand', units: 10 }, newId);
  addEntry(ds, c1.id, bad.id, { kind: 'hand', units: 10 }, newId);
  finishCount(ds, c1.id, '2026-01-02');
  const c2 = startCount(ds, 'x', '2026-02-01', newId);
  addEntry(ds, c2.id, good.id, { kind: 'hand', units: 12 }, newId);
  addEntry(ds, c2.id, bad.id, { kind: 'hand', units: 5 }, newId);
  // corrupt the data behind the domain's validation (e.g. a hand-edited file)
  c2.items.find((i) => i.publicationId === bad.id)!.entries = [{ id: 'z', kind: 'hand', units: -3 }];
  c1.items.find((i) => i.publicationId === bad.id)!.entries = [{ id: 'y', kind: 'hand', units: 0 }];
  const rows = summaryRows(ds, c2.id);
  expect(rows.find((r) => r.publicationId === bad.id)).toMatchObject({ units: null, previous: null, bigChange: false, attention: true });
  expect(rows.find((r) => r.publicationId === good.id)).toMatchObject({ units: 12, previous: 10, attention: false });
});

test('summary groups and sorts by the displayed language name', async () => {
  await loadLanguages();
  const newId = mkId();
  const ds = emptyDataset('d');
  // In Portuguese: Espanhol (S) < Inglês (E) < Português (T); the codes sort the other way round.
  addPublication(ds, pub('A', 'T'), newId);
  addPublication(ds, pub('B', 'E'), newId);
  addPublication(ds, pub('C', 'S'), newId);
  addPublication(ds, pub('D', 'Legacy text'), newId);
  const c = startCount(ds, 'x', 't', newId);
  const rows = summaryRows(ds, c.id, 'pt');
  expect(rows.map((r) => r.language)).toEqual(['Espanhol', 'Inglês', 'Legacy text', 'Português (Brasil)']);
});

test('previous matches by identity after a publication is deleted and re-added', () => {
  const newId = mkId();
  const ds = emptyDataset('d');
  const a = addPublication(ds, pub('A'), newId);
  const c1 = startCount(ds, 'x', '2026-01-01', newId);
  addEntry(ds, c1.id, a.id, { kind: 'hand', units: 100 }, newId);
  finishCount(ds, c1.id, '2026-01-02');
  deletePublication(ds, a.id);
  const a2 = addPublication(ds, pub('A'), newId);
  const c2 = startCount(ds, 'x', '2026-02-01', newId);
  addEntry(ds, c2.id, a2.id, { kind: 'hand', units: 10 }, newId);
  expect(summaryRows(ds, c2.id)[0]).toMatchObject({ units: 10, previous: 100, bigChange: true });
});
