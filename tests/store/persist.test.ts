import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, get, set } from 'idb-keyval';

vi.mock('idb-keyval', async (orig) => {
  const real = await orig<typeof import('idb-keyval')>();
  return { ...real, set: vi.fn(real.set), get: vi.fn(real.get) };
});

import { getCorrupt, listBackups, loadDataset, pushBackup, saveDataset, setStore } from '../../src/store/persist';
import { act, app, flushSaves, init, replaceDataset } from '../../src/store/app.svelte';
import { i18n } from '../../src/i18n/index.svelte';
import { addEntry, addPublication, emptyDataset, startCount } from '../../src/domain/dataset';

let n = 0;
beforeEach(() => { setStore(createStore(`t${n++}`, 'kv')); });

describe('persist', () => {
  it('save then load round-trips', async () => {
    const ds = emptyDataset('a');
    expect(await saveDataset(ds)).toBe(true);
    expect(await loadDataset()).toEqual(ds);
  });

  it('load returns null when nothing is stored', async () => {
    expect(await loadDataset()).toBeNull();
  });

  it('corrupt stored value is backed up and ignored', async () => {
    const store = createStore(`c${n++}`, 'kv');
    setStore(store);
    await set('dataset', { junk: true }, store);
    expect(await loadDataset()).toBeNull();
    expect(await listBackups()).toEqual([]);
    expect(await get('corrupt', store)).toEqual({ junk: true });
  });

  it('getCorrupt returns the raw payload, or undefined when there is none', async () => {
    const store = createStore(`g${n++}`, 'kv');
    setStore(store);
    expect(await getCorrupt()).toBeUndefined();
    await set('dataset', { junk: true }, store);
    await loadDataset();
    expect(await getCorrupt()).toEqual({ junk: true });
  });

  it('init does not overwrite unreadable data when it cannot be kept in the corrupt slot', async () => {
    const store = createStore(`k${n++}`, 'kv');
    setStore(store);
    await set('dataset', { junk: true }, store);
    vi.mocked(set).mockClear();
    vi.mocked(set).mockRejectedValueOnce(new Error('quota'));
    await init();
    expect(app.saveState).toBe('unavailable');
    act(() => 0);
    await flushSaves();
    expect(await get('dataset', store)).toEqual({ junk: true });
  });

  it('backups keep last 5', async () => {
    for (let i = 0; i < 7; i++) await pushBackup(emptyDataset(`d${i}`), `r${i}`);
    const b = await listBackups();
    expect(b).toHaveLength(5);
    expect(b[0].reason).toBe('r6');
    expect(b[4].reason).toBe('r2');
    expect(typeof b[0].savedAt).toBe('string');
  });
});

describe('app', () => {
  it('act saves, and rethrows domain errors without saving', async () => {
    await init();
    expect(app.saveState).toBe('saved');
    act((ds) => addPublication(ds, { name: 'X', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p1'));
    await flushSaves();
    expect((await loadDataset())?.publications).toHaveLength(1);
    expect(() => act(() => { throw 'boom'; })).toThrow('boom');
  });

  it('act that throws midway leaves ds unchanged', async () => {
    await init();
    act((ds) => addPublication(ds, { name: 'A', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'pa'));
    const before = JSON.stringify(app.ds);
    expect(() => act((ds) => { ds.publications[0].name = 'changed'; ds.settings.unit = 'kg'; throw new Error('mid'); })).toThrow('mid');
    expect(JSON.stringify(app.ds)).toBe(before);
  });

  it('act rejects data the file schema would reject and changes nothing', async () => {
    await init();
    act((ds) => addPublication(ds, { name: 'A', language: 'en', variant: '', defaultMode: 'weigh', sample: { units: 10, weightG: 10 } }, () => 'pa'));
    act((ds) => startCount(ds, 'Ann', '2026-01-01', () => 'c1'));
    const before = JSON.stringify(app.ds);
    expect(() => act((ds) => addEntry(ds, 'c1', 'pa', { kind: 'weighing', weightG: 12_300_000 }, () => 'e1'))).toThrow('invalidData');
    expect(JSON.stringify(app.ds)).toBe(before);
    await flushSaves();
    expect(await loadDataset()).toEqual(JSON.parse(before));
    // reactivity still works after a restore
    act((ds) => addEntry(ds, 'c1', 'pa', { kind: 'weighing', weightG: 5 }, () => 'e2'));
    expect(app.ds.counts[0].items[0].entries).toHaveLength(1);
  });

  it('replaceDataset backs up previous', async () => {
    await init();
    const prev = app.ds.datasetId;
    await replaceDataset(emptyDataset('next'), 'import');
    expect(app.ds.datasetId).toBe('next');
    const b = await listBackups();
    expect(b[0].reason).toBe('import');
    expect(b[0].dataset.datasetId).toBe(prev);
    expect((await loadDataset())?.datasetId).toBe('next');
  });

  it('replaceDataset re-applies the incoming language and theme', async () => {
    await init();
    i18n.lang = 'en';
    await replaceDataset(emptyDataset('next', { language: 'es', theme: 'dark' }), 'import');
    expect(i18n.lang).toBe('es');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('es');
    await replaceDataset(emptyDataset('next2', { theme: 'system' }), 'import');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    i18n.lang = 'en';
  });

  it('read error leaves stored data untouched and does not save', async () => {
    vi.mocked(set).mockClear();
    vi.mocked(get).mockRejectedValueOnce(new Error('read'));
    await init();
    expect(app.saveState).toBe('unavailable');
    act(() => 0);
    await flushSaves();
    expect(set).not.toHaveBeenCalled();
    expect(app.saveState).toBe('unavailable');
  });

  it('replaceDataset does not swap when the backup fails', async () => {
    await init();
    const prev = app.ds.datasetId;
    vi.mocked(set).mockRejectedValueOnce(new Error('quota'));
    await expect(replaceDataset(emptyDataset('next'), 'import')).rejects.toBe('backupFailed');
    expect(app.ds.datasetId).toBe(prev);
  });

  it('concurrent backups are not dropped and a good save recovers from unavailable', async () => {
    await init();
    vi.mocked(set).mockRejectedValueOnce(new Error('quota'));
    act(() => 0);
    await flushSaves();
    expect(app.saveState).toBe('unavailable');
    await Promise.all([replaceDataset(emptyDataset('a'), 'r1'), replaceDataset(emptyDataset('b'), 'r2')]);
    expect(await listBackups()).toHaveLength(2);
    expect(app.saveState).toBe('saved');
  });

  it('save failure sets unavailable and keeps data in memory', async () => {
    await init();
    vi.mocked(set).mockRejectedValue(new Error('quota'));
    act((ds) => addPublication(ds, { name: 'Y', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p2'));
    await flushSaves();
    expect(app.saveState).toBe('unavailable');
    expect(app.ds.publications.some((p) => p.id === 'p2')).toBe(true);
    vi.mocked(set).mockReset();
  });
});
