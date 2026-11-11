import { expect, test } from 'vitest';
import {
  capacityG, checkWeighing, fractionWarning, itemTotal, resolutionAt, sampleAdvice, validateScale,
} from '../../src/domain/calc';
import type { CountItem, Entry, Sample, ScaleRange } from '../../src/domain/types';

const scale: ScaleRange[] = [{ upToG: 500, resolutionG: 0.1 }, { upToG: 1000, resolutionG: 0.5 }, { upToG: 10000, resolutionG: 1 }];
const item = (entries: Entry[], sample: Sample | undefined = { units: 200, weightG: 489 }): CountItem =>
  ({ publicationId: 'p', sample, entries, zero: false, entered: false });
const w = (g: number): Entry => ({ id: String(g), kind: 'weighing', weightG: g });

test('pilot row 4: 5868 g of 2.445 g leaflets = 2400 + 2880 sealed', () => {
  const t = itemTotal(item([w(813), w(1202), w(1535), w(1270), w(1048), { id: 's', kind: 'sealed', packs: 7, perPack: 400 }, { id: 'h', kind: 'hand', units: 80 }]), scale)!;
  expect(t.units).toBe(5280);
  expect(t.weighedUnits).toBeCloseTo(2400, 6);
  expect(t.margin).toBe(24); // 1% floor dominates
});
test('not counted vs zero', () => {
  expect(itemTotal(item([]), scale)).toBeNull();
  expect(itemTotal({ ...item([]), zero: true }, scale)).toEqual({ units: 0, margin: 0, weighedUnits: 0 });
});
test('sample entry counts, exact parts have no margin', () => {
  expect(itemTotal(item([{ id: 'a', kind: 'sample', units: 20, weightG: 520.4 }], { units: 20, weightG: 520.4 }), scale))
    .toEqual({ units: 20, margin: 0, weighedUnits: 0 });
});
test('never NaN', () => {
  expect(() => itemTotal({ publicationId: 'p', entries: [w(100)], zero: false, entered: false }, scale)).toThrow('missingSample');
  expect(() => itemTotal(item([w(100)], { units: 0, weightG: 10 }), scale)).toThrow('invalidSample');
});
test('resolution ranges', () => {
  expect(resolutionAt(scale, 489)).toBe(0.1); expect(resolutionAt(scale, 700)).toBe(0.5);
  expect(resolutionAt(scale, 5868)).toBe(1); expect(resolutionAt(null, 50)).toBe(1);
  expect(capacityG(scale)).toBe(10000);
});
test('sample advice', () => {
  expect(sampleAdvice({ units: 5, weightG: 99 }, null)).toEqual({ ok: false, suggestedUnits: 11 }); // d=1 → S≥200 g, u=19.8
  expect(sampleAdvice({ units: 200, weightG: 489 }, scale).ok).toBe(true);
});
test('weighing checks', () => {
  const it = item([w(1630), w(1054), w(2027)], { units: 5, weightG: 181 });
  expect(checkWeighing(10230, it, scale)).toContain('overCapacity');
  expect(checkWeighing(1.23, it, scale)).toContain('belowOneUnit'); // Review Focus 1
  expect(checkWeighing(2027, it, scale)).toContain('duplicateOfLast');
  expect(checkWeighing(9000, it, scale)).toContain('outlier');
  expect(checkWeighing(1500, it, scale)).toEqual([]);
});
test('validateScale', () => {
  expect(validateScale(scale)).toBe('ok');
  expect(validateScale([{ upToG: 1000, resolutionG: 1 }, { upToG: 500, resolutionG: 2 }])).toBe('notAscending');
  expect(validateScale([{ upToG: 500, resolutionG: 1 }, { upToG: 1000, resolutionG: 0.5 }])).toBe('resolutionDecreases');
});
test('fraction warning', () => {
  expect(fractionWarning({ units: 24, margin: 1, weighedUnits: 23.5 })).toBe(true);
  expect(fractionWarning({ units: 24, margin: 1, weighedUnits: 23.95 })).toBe(false);
});

test('float noise does not inflate the ceil', () => {
  expect(itemTotal(item([w(1222.5)]), scale)!.margin).toBe(5);
  expect(sampleAdvice({ units: 29, weightG: 100 }, [{ upToG: 1000, resolutionG: 0.5 }]).suggestedUnits).toBe(29);
});
test('invalid entries throw', () => {
  const bad: Entry[] = [
    w(0), w(NaN), w(-5),
    { id: 'x', kind: 'sealed', packs: 0, perPack: 10 },
    { id: 'x', kind: 'sealed', packs: 2, perPack: 1.5 },
    { id: 'x', kind: 'hand', units: -1 },
    { id: 'x', kind: 'sample', units: 5, weightG: 0 },
  ];
  for (const e of bad) expect(() => itemTotal(item([e]), scale)).toThrow('invalidEntry');
});
test('scale error dominates the 1% floor', () => {
  expect(itemTotal(item([w(50)], { units: 2, weightG: 10 }), null)!.margin).toBe(2);
});
test('resolution boundaries', () => {
  expect(resolutionAt(scale, 500)).toBe(0.1);
  expect(resolutionAt(scale, 20000)).toBe(1);
});
test('outlier median with an even count', () => {
  const it = item([w(100), w(200), w(300), w(400)], { units: 100, weightG: 100 }); // median 250
  expect(checkWeighing(760, it, null)).toContain('outlier');
  expect(checkWeighing(740, it, null)).not.toContain('outlier');
});
test('validateScale extra codes', () => {
  expect(validateScale([])).toBe('empty');
  expect(validateScale([{ upToG: 0, resolutionG: 1 }])).toBe('nonPositive');
  expect(validateScale([{ upToG: 500, resolutionG: -1 }])).toBe('nonPositive');
  expect(validateScale([{ upToG: NaN, resolutionG: 1 }])).toBe('nonPositive');
});
