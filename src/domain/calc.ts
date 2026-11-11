import type { CountItem, Sample, ScaleRange } from './types';

export const DEFAULT_RESOLUTION_G = 1;
export const VARIATION_FLOOR = 0.01;

export function resolutionAt(scale: ScaleRange[] | null, weightG: number): number {
  if (!scale || scale.length === 0) return DEFAULT_RESOLUTION_G;
  const range = scale.find((r) => weightG <= r.upToG) ?? scale[scale.length - 1];
  return range.resolutionG;
}

export function capacityG(scale: ScaleRange[] | null): number | null {
  return scale && scale.length > 0 ? scale[scale.length - 1].upToG : null;
}

// NOTE: snaps floating-point noise just above an integer so ceil does not add a spurious unit.
const ceilSafe = (x: number): number => Math.ceil(x - 1e-9);

export function validateScale(
  scale: ScaleRange[],
): 'ok' | 'notAscending' | 'resolutionDecreases' | 'empty' | 'nonPositive' {
  if (scale.length === 0) return 'empty';
  for (let i = 0; i < scale.length; i++) {
    const r = scale[i];
    if (!(Number.isFinite(r.upToG) && r.upToG > 0) || !(Number.isFinite(r.resolutionG) && r.resolutionG > 0)) {
      return 'nonPositive';
    }
    if (i > 0 && r.upToG <= scale[i - 1].upToG) return 'notAscending';
    if (i > 0 && r.resolutionG < scale[i - 1].resolutionG) return 'resolutionDecreases';
  }
  return 'ok';
}

export function unitWeightG(s: Sample): number {
  if (!(s.units > 0) || !(s.weightG > 0)) throw new Error('invalidSample');
  return s.weightG / s.units;
}

export interface ItemTotal { units: number; margin: number; weighedUnits: number }

export function itemTotal(item: CountItem, scale: ScaleRange[] | null): ItemTotal | null {
  if (!item.zero && item.entries.length === 0) return null;
  if (item.zero) return { units: 0, margin: 0, weighedUnits: 0 };

  const posG = (x: number) => Number.isFinite(x) && x > 0;
  const posInt = (x: number) => Number.isInteger(x) && x >= 1;
  const weights: number[] = [];
  let exact = 0;
  for (const e of item.entries) {
    const valid =
      e.kind === 'weighing' ? posG(e.weightG)
      : e.kind === 'sample' ? posInt(e.units) && posG(e.weightG)
      : e.kind === 'hand' ? posInt(e.units)
      : posInt(e.packs) && posInt(e.perPack);
    if (!valid) throw new Error('invalidEntry');
    if (e.kind === 'weighing') weights.push(e.weightG);
    else if (e.kind === 'sample' || e.kind === 'hand') exact += e.units;
    else exact += e.packs * e.perPack;
  }

  let weighedUnits = 0;
  let margin = 0;
  if (weights.length > 0) {
    if (!item.sample) throw new Error('missingSample');
    const u = unitWeightG(item.sample);
    const totalW = weights.reduce((a, b) => a + b, 0);
    weighedUnits = totalW / u;
    const sumD2 = weights.reduce((a, w) => a + resolutionAt(scale, w) ** 2, 0);
    const relW = Math.sqrt(sumD2) / totalW;
    const relS = resolutionAt(scale, item.sample.weightG) / item.sample.weightG;
    const scaleErr = weighedUnits * Math.sqrt(relW ** 2 + relS ** 2);
    margin = ceilSafe(Math.max(scaleErr, VARIATION_FLOOR * weighedUnits));
  }
  return { units: Math.round(weighedUnits + exact), margin, weighedUnits };
}

export function sampleAdvice(s: Sample, scale: ScaleRange[] | null): { ok: boolean; suggestedUnits: number } {
  const d = resolutionAt(scale, s.weightG);
  const u = unitWeightG(s);
  return { ok: s.units >= 10 && s.weightG >= 200 * d, suggestedUnits: Math.max(10, ceilSafe((200 * d) / u)) };
}

export function fractionWarning(t: ItemTotal): boolean {
  if (!(t.weighedUnits > 0 && t.weighedUnits < 100)) return false;
  const frac = t.weighedUnits - Math.floor(t.weighedUnits);
  return frac >= 0.3 && frac <= 0.7;
}

export type WeighingIssue = 'overCapacity' | 'belowOneUnit' | 'duplicateOfLast' | 'outlier';

export function checkWeighing(weightG: number, item: CountItem, scale: ScaleRange[] | null): WeighingIssue[] {
  const issues: WeighingIssue[] = [];
  const cap = capacityG(scale);
  if (cap !== null && weightG > cap) issues.push('overCapacity');
  if (item.sample && item.sample.units > 0 && item.sample.weightG > 0 && weightG < unitWeightG(item.sample)) {
    issues.push('belowOneUnit');
  }
  const ws = item.entries.flatMap((e) => (e.kind === 'weighing' ? [e.weightG] : []));
  if (ws.length > 0 && ws[ws.length - 1] === weightG) issues.push('duplicateOfLast');
  if (ws.length >= 2) {
    const sorted = [...ws].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (weightG > 3 * median || weightG < median / 3) issues.push('outlier');
  }
  return issues;
}
