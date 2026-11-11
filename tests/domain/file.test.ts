import { describe, expect, it } from 'vitest';
import { emptyDataset } from '../../src/domain/dataset';
import { exportFileName, parseDataset, serializeDataset } from '../../src/domain/file';
import type { Dataset } from '../../src/domain/types';

const full = (): Dataset => ({
  ...emptyDataset('d1', { locationName: 'Salão Centro', language: 'pt', lastCounter: 'Ana' }),
  settings: { unit: 'kg', scale: [{ upToG: 1000, resolutionG: 1 }], theme: 'dark', language: 'pt', locationName: 'Salão Centro', firstRunDone: true },
  publications: [
    { id: 'p1', name: 'Watchtower', language: 'en', variant: 'Study', sample: { units: 10, weightG: 100 }, packSize: 50, defaultMode: 'weigh', archived: false },
    { id: 'p2', name: 'Book', language: 'pt', variant: '', defaultMode: 'hand', archived: true },
  ],
  counts: [{
    id: 'c1', startedAt: '2026-11-01', finishedAt: '2026-11-02', counter: 'Ana', items: [
      { publicationId: 'p1', sample: { units: 10, weightG: 100 }, zero: false, entered: true, entries: [
        { id: 'e1', kind: 'weighing', weightG: 500 }, { id: 'e2', kind: 'sealed', packs: 2, perPack: 50 },
        { id: 'e3', kind: 'hand', units: 3 }, { id: 'e4', kind: 'sample', units: 5, weightG: 50 }] },
      { publicationId: 'p2', zero: true, entered: false, entries: [] },
    ],
  }],
});
const bad = (mut: (d: any) => void) => { const d: any = JSON.parse(serializeDataset(full())); mut(d); return parseDataset(JSON.stringify(d)); };

describe('pubcount file', () => {
  it('round trips', () => {
    const r = parseDataset(serializeDataset(full()));
    expect(r).toEqual({ ok: true, dataset: full() });
  });
  it('pretty prints', () => expect(serializeDataset(full())).toContain('\n  "formatVersion": 1'));
  it('notJson', () => expect(parseDataset('{')).toEqual({ ok: false, error: 'notJson' }));
  it('invalid on missing fields', () => expect(parseDataset('{"formatVersion":1}')).toEqual({ ok: false, error: 'invalid' }));
  it('invalid on non-object', () => expect(parseDataset('null')).toEqual({ ok: false, error: 'invalid' }));
  it('tooNew', () => expect(bad((d) => { d.formatVersion = 2; })).toEqual({ ok: false, error: 'tooNew' }));
  it.each([
    ['negative weighing', (d: any) => { d.counts[0].items[0].entries[0].weightG = -5; }],
    ['zero sample units', (d: any) => { d.publications[0].sample.units = 0; }],
    ['fractional packs', (d: any) => { d.counts[0].items[0].entries[1].packs = 1.5; }],
    ['zero hand units', (d: any) => { d.counts[0].items[0].entries[2].units = 0; }],
    ['bad enum', (d: any) => { d.settings.unit = 'stone'; }],
    ['bad entry kind', (d: any) => { d.counts[0].items[0].entries[0].kind = 'x'; }],
    ['empty id', (d: any) => { d.publications[0].id = ''; }],
    ['long name', (d: any) => { d.publications[0].name = 'x'.repeat(201); }],
    ['control char', (d: any) => { d.publications[0].variant = 'a\u0000b'; }],
    ['zero scale range', (d: any) => { d.settings.scale[0].upToG = 0; }],
    ['two open counts', (d: any) => { delete d.counts[0].finishedAt; d.counts.push({ id: 'c2', startedAt: '2026-11-03', counter: '', items: [] }); }],
    ['unknown publication', (d: any) => { d.counts[0].items[0].publicationId = 'zz'; }],
    ['duplicate publication', (d: any) => { d.publications[1].id = 'p1'; }],
  ])('invalid: %s', (_n, mut) => expect(bad(mut)).toEqual({ ok: false, error: 'invalid' }));

  it.each([
    ['bad startedAt', (d: any) => { d.counts[0].startedAt = 'x'; }],
    ['bad finishedAt month', (d: any) => { d.counts[0].finishedAt = '2026-13-45'; }],
    ['grams too big', (d: any) => { d.counts[0].items[0].entries[0].weightG = 1e7 + 1; }],
    ['units too big', (d: any) => { d.counts[0].items[0].entries[2].units = 1e6 + 1; }],
    ['packSize too big', (d: any) => { d.publications[0].packSize = 1e6 + 1; }],
    ['scale too big', (d: any) => { d.settings.scale[0].upToG = 1e7 + 1; }],
    ['scale not ascending', (d: any) => { d.settings.scale = [{ upToG: 10, resolutionG: 1 }, { upToG: 5, resolutionG: 1 }]; }],
    ['empty scale', (d: any) => { d.settings.scale = []; }],
    ['duplicate count id', (d: any) => { d.counts.push({ ...d.counts[0] }); }],
    ['duplicate item publication', (d: any) => { d.counts[0].items.push({ ...d.counts[0].items[0] }); }],
    ['duplicate entry id', (d: any) => { d.counts[0].items[0].entries[1].id = 'e1'; }],
    ['zero with entries', (d: any) => { d.counts[0].items[0].zero = true; }],
    ['two sample entries', (d: any) => { d.counts[0].items[0].entries.push({ id: 'e9', kind: 'sample', units: 1, weightG: 1 }); }],
    ['extra key', (d: any) => { d.extra = 1; }],
    ['formatVersion 0', (d: any) => { d.formatVersion = 0; }],
    ['formatVersion -1', (d: any) => { d.formatVersion = -1; }],
    ['formatVersion string', (d: any) => { d.formatVersion = '1'; }],
  ])('invalid: %s', (_n, mut) => expect(bad(mut)).toEqual({ ok: false, error: 'invalid' }));

  it('accepts boundaries and timestamps', () => {
    const r = bad((d) => {
      d.counts[0].startedAt = '2026-11-01T10:00:00.000Z'; d.counts[0].finishedAt = '2026-11-02T10:00:00+01:00';
      d.counts[0].items[0].entries[0].weightG = 1e7; d.counts[0].items[0].entries[2].units = 1e6;
    });
    expect(r.ok).toBe(true);
  });
  it.each(['[]', '"abc"', '{"__proto__":{"x":1},"formatVersion":1}', '{"constructor":1}'])('invalid raw %s', (t) =>
    expect(parseDataset(t)).toEqual({ ok: false, error: 'invalid' }));
  it('tooNew garbage', () => expect(parseDataset('{"formatVersion":99,"junk":true}')).toEqual({ ok: false, error: 'tooNew' }));
  it('oversized text', () => expect(parseDataset(' '.repeat(5_000_001))).toEqual({ ok: false, error: 'invalid' }));

  it('exportFileName', () => {
    expect(exportFileName(full(), '2026-11-11')).toBe('salao-centro-2026-11-11.pubcount');
    expect(exportFileName(emptyDataset('x'), '2026-11-11')).toBe('pubcount-2026-11-11.pubcount');
    expect(exportFileName(emptyDataset('x', { locationName: '!!!' }), '2026-11-11')).toBe('pubcount-2026-11-11.pubcount');
  });
});
