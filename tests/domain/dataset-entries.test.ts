import { expect, test } from 'vitest';
import {
  addEntry, addPublication, archivePublication, copySample, emptyDataset, finishCount, markZero, resetItem, setEntered, setSample, startCount, updateEntry, updatePublication, deleteEntry,
} from '../../src/domain/dataset';
import { validateDataset } from '../../src/domain/file';
import { itemTotal } from '../../src/domain/calc';
import { pub, err, setup } from './dataset-fixtures';

test('setSample replaces previous sample entry and reports it', () => {
  const { ds, newId, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  addEntry(ds, c.id, b.id, { kind: 'hand', units: 1 }, newId);
  expect(setSample(ds, c.id, b.id, { units: 10, weightG: 50 }, newId)).toEqual({ replacedPrevious: false });
  const item = c.items.find((i) => i.publicationId === b.id)!;
  expect(item.entries[0]).toMatchObject({ kind: 'sample', units: 10, weightG: 50 });
  expect(item.entries).toHaveLength(2);
  expect(setSample(ds, c.id, b.id, { units: 20, weightG: 80 }, newId)).toEqual({ replacedPrevious: true });
  expect(item.entries.filter((e) => e.kind === 'sample')).toHaveLength(1);
  expect(item.sample).toEqual({ units: 20, weightG: 80 });
  expect(b.sample).toEqual({ units: 20, weightG: 80 });
});

test('copySample copies to publication and open snapshot', () => {
  const { ds, newId, a, b } = setup();
  expect(err(() => copySample(ds, b.id, a.id))).toBe('missingSample');
  const c = startCount(ds, 'A', 't', newId);
  copySample(ds, a.id, b.id);
  expect(b.sample).toEqual(a.sample);
  expect(b.sample).not.toBe(a.sample);
  const item = c.items.find((i) => i.publicationId === b.id)!;
  expect(item.sample).toEqual(a.sample);
  expect(item.entries).toEqual([]);
  expect(err(() => copySample(ds, 'nope', b.id))).toBe('notFound');
});

test('markZero then addEntry clears zero', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  addEntry(ds, c.id, a.id, { kind: 'hand', units: 2 }, newId);
  markZero(ds, c.id, a.id);
  expect(c.items[0]).toMatchObject({ zero: true, entries: [] });
  addEntry(ds, c.id, a.id, { kind: 'hand', units: 2 }, newId);
  expect(c.items[0].zero).toBe(false);
  resetItem(ds, c.id, a.id);
  expect(c.items[0]).toMatchObject({ zero: false, entries: [] });
  setEntered(ds, c.id, a.id, true);
  expect(c.items[0].entered).toBe(true);
});

test('unknown ids throw notFound', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  expect(err(() => markZero(ds, 'x', a.id))).toBe('notFound');
  expect(err(() => markZero(ds, c.id, 'x'))).toBe('notFound');
  expect(err(() => deleteEntry(ds, c.id, a.id, 'x'))).toBe('notFound');
  expect(err(() => archivePublication(ds, 'x', true))).toBe('notFound');
  expect(err(() => updatePublication(ds, 'x', {}))).toBe('notFound');
});

test('publication validation: sample, name, packSize; sample stored as copy', () => {
  const { ds, newId, b } = setup();
  const bad = [
    pub('X', { sample: { units: 0, weightG: 0 } }), pub('X', { sample: { units: 2, weightG: -1 } }),
    pub('X', { sample: { units: 1.5, weightG: 5 } }), pub('X', { sample: { units: 2, weightG: NaN } }),
  ];
  for (const p of bad) expect(err(() => addPublication(ds, p, newId))).toBe('invalidEntry');
  expect(err(() => addPublication(ds, pub('   '), newId))).toBe('invalidPublication');
  expect(err(() => addPublication(ds, pub('Y', { packSize: 0 }), newId))).toBe('invalidPublication');
  expect(err(() => addPublication(ds, pub('Y', { packSize: 2.5 }), newId))).toBe('invalidPublication');
  expect(err(() => updatePublication(ds, b.id, { sample: { units: 0, weightG: 0 } }))).toBe('invalidEntry');
  expect(err(() => updatePublication(ds, b.id, { name: ' ' }))).toBe('invalidPublication');
  expect(err(() => updatePublication(ds, b.id, { packSize: -1 }))).toBe('invalidPublication');
  const s = { units: 5, weightG: 50 };
  const ok = addPublication(ds, pub('Ok', { sample: s }), newId);
  expect(ok.sample).toEqual(s);
  expect(ok.sample).not.toBe(s);
  const s2 = { units: 6, weightG: 60 };
  updatePublication(ds, ok.id, { sample: s2 });
  expect(ok.sample).not.toBe(s2);
  expect(ds.publications.map((p) => p.name)).not.toContain('X');
});

test('updatePublication ignores archived in the patch', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  updatePublication(ds, a.id, { archived: true } as never);
  expect(a.archived).toBe(false);
  expect(c.items).toHaveLength(2);
});

test('sample entries are locked: updateEntry/deleteEntry throw useSetSample', () => {
  const { ds, newId, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  setSample(ds, c.id, b.id, { units: 10, weightG: 50 }, newId);
  const e = c.items.find((i) => i.publicationId === b.id)!.entries[0];
  expect(err(() => updateEntry(ds, c.id, b.id, e.id, { units: 3 }))).toBe('useSetSample');
  expect(err(() => deleteEntry(ds, c.id, b.id, e.id))).toBe('useSetSample');
});

test('copySample keeps existing sample entry as counted units, new unit weight applies', () => {
  const { ds, newId, a, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  setSample(ds, c.id, b.id, { units: 10, weightG: 50 }, newId);
  addEntry(ds, c.id, b.id, { kind: 'weighing', weightG: 100 }, newId);
  copySample(ds, a.id, b.id); // a: 10 units / 100 g => 10 g each
  const item = c.items.find((i) => i.publicationId === b.id)!;
  expect(item.sample).toEqual(a.sample);
  expect(item.entries.find((e) => e.kind === 'sample')).toMatchObject({ units: 10, weightG: 50 });
  expect(itemTotal(item, null)!.units).toBe(10 + 10);
});

test('updateEntry stores only the fields of its kind', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  const e = addEntry(ds, c.id, a.id, { kind: 'hand', units: 2 }, newId);
  updateEntry(ds, c.id, a.id, e.id, { units: 3, packs: 9, junk: 1 } as never);
  expect(c.items[0].entries[0]).toEqual({ id: e.id, kind: 'hand', units: 3 });
});

test('emptyDataset ignores undefined overrides', () => {
  const ds = emptyDataset('x', { unit: undefined, theme: 'dark' });
  expect(ds.settings.unit).toBe('g');
  expect(ds.settings.theme).toBe('dark');
});

test('unarchive re-adds to open count, and throws duplicate when twin active', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  archivePublication(ds, a.id, true);
  expect(c.items.some((i) => i.publicationId === a.id)).toBe(false);
  archivePublication(ds, a.id, false);
  expect(c.items.find((i) => i.publicationId === a.id)).toMatchObject({ entries: [], zero: false });
  archivePublication(ds, a.id, true);
  addPublication(ds, pub('Alpha', { sample: { units: 10, weightG: 100 } }), newId);
  expect(err(() => archivePublication(ds, a.id, false))).toBe('duplicate');
});

test('setEntered works on finished counts; finishCount twice throws', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  finishCount(ds, c.id, 't2');
  setEntered(ds, c.id, a.id, true);
  expect(c.items[0].entered).toBe(true);
  expect(err(() => finishCount(ds, c.id, 't3'))).toBe('countFinished');
});

test('cleans publication fields, counter and keeps data schema-valid', () => {
  const ds = emptyDataset('d');
  const p = addPublication(ds, { name: 'A\tB', language: 'P\nT', variant: 'v\u0000', defaultMode: 'hand' }, () => 'p1');
  expect([p.name, p.language, p.variant]).toEqual(['A B', 'P T', 'v']);
  updatePublication(ds, 'p1', { name: 'C\tD', variant: '\t' });
  expect([ds.publications[0].name, ds.publications[0].variant]).toEqual(['C D', '']);
  expect(() => addPublication(ds, { name: '\t', language: '', variant: '', defaultMode: 'hand' }, () => 'p2')).toThrow('invalidPublication');
  const c = startCount(ds, 'An\tna', '2026-01-01', () => 'c1');
  expect(c.counter).toBe('An na');
  expect(ds.settings.lastCounter).toBe('An na');
  expect(validateDataset(ds)).toBe(true);
});

