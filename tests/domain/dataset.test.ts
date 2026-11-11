import { expect, test } from 'vitest';
import {
  addEntry, addPublication, archivePublication, emptyDataset, finishCount, markZero, openCount, reopenCount, resetItem, setSample, startCount, updateEntry, updatePublication, deleteEntry,
} from '../../src/domain/dataset';
import { itemTotal } from '../../src/domain/calc';
import { pub, err, setup } from './dataset-fixtures';
import { loadLanguages } from '../../src/domain/languages.svelte';

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
  expect(err(() => updateEntry(ds, c.id, a.id, e.id, { units: 0 }))).toBe('invalidEntry');
  expect(err(() => updateEntry(ds, c.id, a.id, e.id, { kind: 'weighing' } as never))).toBe('invalidEntry');
  updateEntry(ds, c.id, a.id, e.id, { units: 6, id: 'hacked' });
  expect(c.items[0].entries[0]).toEqual({ id: e.id, kind: 'hand', units: 6 });
});

test('weighing without sample throws missingSample', () => {
  const { ds, newId, b } = setup();
  const c = startCount(ds, 'A', 't', newId);
  expect(err(() => addEntry(ds, c.id, b.id, { kind: 'weighing', weightG: 50 }, newId))).toBe('missingSample');
});


test('legacy free-text language and its code count as the same identity', async () => {
  await loadLanguages();
  const ds = emptyDataset('d1');
  const newId = (() => { let n = 0; return () => `x${++n}`; })();
  addPublication(ds, pub('Sentinela', { language: 'Inglês' }), newId);
  expect(err(() => addPublication(ds, pub('Sentinela', { language: 'E' }), newId))).toBe('duplicate');
});
