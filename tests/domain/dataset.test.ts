import { expect, test } from 'vitest';
import {
  addEntry, addPublication, archivePublication, copySample, emptyDataset, finishCount, markZero, openCount,
  reopenCount, resetItem, setEntered, setSample, startCount, updateEntry, updatePublication, deleteEntry,
} from '../../src/domain/dataset';
import { itemTotal } from '../../src/domain/calc';

const mkId = () => { let n = 0; return () => `id${++n}`; };
const pub = (name: string, extra = {}) => ({ name, language: 'pt', variant: '', defaultMode: 'weigh' as const, ...extra });
const err = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as Error).message; } return 'no throw'; };

function setup() {
  const newId = mkId();
  const ds = emptyDataset('d1');
  const a = addPublication(ds, pub('Alpha', { sample: { units: 10, weightG: 100 } }), newId);
  const b = addPublication(ds, pub('Beta'), newId);
  return { ds, newId, a, b };
}

test('emptyDataset defaults and overrides', () => {
  const ds = emptyDataset('x', { unit: 'kg' });
  expect(ds.settings).toMatchObject({ unit: 'kg', scale: null, theme: 'system', firstRunDone: false });
});

test('start copies active publications as not counted and snapshots sample', () => {
  const { ds, newId, a, b } = setup();
  archivePublication(ds, b.id, true);
  const c = startCount(ds, 'Ana', '2026-01-01', newId);
  expect(c.items).toHaveLength(1);
  expect(c.items[0]).toMatchObject({ publicationId: a.id, entries: [], zero: false, entered: false });
  expect(c.items[0].sample).toEqual(a.sample);
  expect(c.items[0].sample).not.toBe(a.sample);
  expect(ds.settings.lastCounter).toBe('Ana');
  expect(openCount(ds)).toBe(c);
});

test('cannot start a second open count', () => {
  const { ds, newId } = setup();
  startCount(ds, 'A', 't', newId);
  expect(err(() => startCount(ds, 'B', 't', newId))).toBe('countAlreadyOpen');
});

test('finished count rejects entries', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  addEntry(ds, c.id, a.id, { kind: 'hand', units: 3 }, newId);
  finishCount(ds, c.id, 't2');
  expect(err(() => addEntry(ds, c.id, a.id, { kind: 'hand', units: 1 }, newId))).toBe('countFinished');
  expect(err(() => markZero(ds, c.id, a.id))).toBe('countFinished');
  expect(err(() => resetItem(ds, c.id, a.id))).toBe('countFinished');
  expect(err(() => setSample(ds, c.id, a.id, { units: 1, weightG: 1 }, newId))).toBe('countFinished');
  expect(err(() => deleteEntry(ds, c.id, a.id, 'x'))).toBe('countFinished');
  expect(err(() => updateEntry(ds, c.id, a.id, 'x', { units: 2 }))).toBe('countFinished');
});

test('reopen finished count', () => {
  const { ds, newId } = setup();
  const c1 = startCount(ds, 'A', 't', newId);
  finishCount(ds, c1.id, 't2');
  const c2 = startCount(ds, 'A', 't3', newId);
  expect(err(() => reopenCount(ds, c1.id))).toBe('countAlreadyOpen');
  finishCount(ds, c2.id, 't4');
  reopenCount(ds, c1.id);
  expect(openCount(ds)?.id).toBe(c1.id);
  expect(err(() => reopenCount(ds, 'nope'))).toBe('notFound');
});

test('duplicate publication rejected ignoring case/accents/spaces', () => {
  const { ds, newId, b } = setup();
  expect(err(() => addPublication(ds, pub('  álpha '.toUpperCase()), newId))).toBe('duplicate');
  expect(err(() => updatePublication(ds, b.id, { name: 'ALPHA' }))).toBe('duplicate');
  updatePublication(ds, b.id, { name: 'Gamma' });
  expect(b.name).toBe('Gamma');
});

test('publication added mid-count appears not counted', () => {
  const { ds, newId } = setup();
  const c = startCount(ds, 'A', 't', newId);
  const p = addPublication(ds, pub('Late'), newId);
  const item = c.items.find((i) => i.publicationId === p.id)!;
  expect(item).toMatchObject({ entries: [], zero: false });
  expect(itemTotal(item, null)).toBeNull();
});

test('archive mid-count removes only empty items', () => {
  const { ds, newId, a, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  addEntry(ds, c.id, a.id, { kind: 'hand', units: 2 }, newId);
  archivePublication(ds, a.id, true);
  archivePublication(ds, b.id, true);
  expect(c.items.map((i) => i.publicationId)).toEqual([a.id]);
  const c2 = ds.counts[0];
  finishCount(ds, c2.id, 't2');
  const snapshot = JSON.stringify(c2);
  archivePublication(ds, a.id, false);
  expect(JSON.stringify(c2)).toBe(snapshot);
});

test('archive keeps zero items and finished counts untouched', () => {
  const { ds, newId, a, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  markZero(ds, c.id, a.id);
  archivePublication(ds, a.id, true);
  expect(c.items.map((i) => i.publicationId)).toContain(a.id);
  finishCount(ds, c.id, 't2');
  archivePublication(ds, b.id, true);
  expect(c.items).toHaveLength(2);
});

test('invalid entries rejected (0 packs, 0 units, 0 g, negative)', () => {
  const { ds, newId, a } = setup();
  const c = startCount(ds, 'A', 't', newId);
  const bad = [
    { kind: 'sealed', packs: 0, perPack: 5 }, { kind: 'sealed', packs: 2, perPack: 0 },
    { kind: 'sealed', packs: -1, perPack: 5 }, { kind: 'sealed', packs: 1.5, perPack: 5 },
    { kind: 'hand', units: 0 }, { kind: 'hand', units: -3 }, { kind: 'hand', units: 2.5 },
    { kind: 'weighing', weightG: 0 }, { kind: 'weighing', weightG: -5 }, { kind: 'weighing', weightG: NaN },
    { kind: 'weighing', weightG: Infinity },
    { kind: 'sample', units: 0, weightG: 10 }, { kind: 'sample', units: 5, weightG: 0 },
  ] as const;
  for (const e of bad) expect(err(() => addEntry(ds, c.id, a.id, { ...e }, newId))).toBe('invalidEntry');
  expect(err(() => setSample(ds, c.id, a.id, { units: 0, weightG: 10 }, newId))).toBe('invalidEntry');
  expect(err(() => setSample(ds, c.id, a.id, { units: 5, weightG: 0 }, newId))).toBe('invalidEntry');
  expect(c.items[0].entries).toEqual([]);
  const e = addEntry(ds, c.id, a.id, { kind: 'hand', units: 4 }, newId);
  expect(err(() => updateEntry(ds, c.id, a.id, e.id, { units: 0 } as never))).toBe('invalidEntry');
  expect(err(() => updateEntry(ds, c.id, a.id, e.id, { kind: 'weighing' } as never))).toBe('invalidEntry');
  updateEntry(ds, c.id, a.id, e.id, { units: 6, id: 'hacked' } as never);
  expect(c.items[0].entries[0]).toEqual({ id: e.id, kind: 'hand', units: 6 });
});

test('weighing without sample throws missingSample', () => {
  const { ds, newId, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  expect(err(() => addEntry(ds, c.id, b.id, { kind: 'weighing', weightG: 50 }, newId))).toBe('missingSample');
});

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
  expect(err(() => updateEntry(ds, c.id, b.id, e.id, { units: 3 } as never))).toBe('useSetSample');
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
