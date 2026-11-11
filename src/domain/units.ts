import type { WeightUnit } from './types';

const GRAMS_PER_UNIT: Record<WeightUnit, number> = {
  g: 1,
  kg: 1000,
  lb: 453.59237,
  oz: 28.349523125,
};

/** Digits with at most one "," or "." separator; the dot is always decimal. Zero is accepted. */
export function parseDecimal(input: string): number | null {
  const s = input.trim();
  if (!/^(\d+[.,]?\d*|[.,]\d+)$/.test(s)) return null;
  return Number(s.replace(',', '.'));
}

export const toGrams = (value: number, unit: WeightUnit): number => value * GRAMS_PER_UNIT[unit];
export const fromGrams = (grams: number, unit: WeightUnit): number => grams / GRAMS_PER_UNIT[unit];
