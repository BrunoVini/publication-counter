import { describe, expect, it } from 'vitest';
import { fromGrams, parseDecimal, toGrams } from '../../src/domain/units';

describe('units', () => {
  it('parses decimals', () => {
    expect(parseDecimal('1230')).toBe(1230);
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal('2.5')).toBe(2.5);
    expect(parseDecimal(' 1.230 ')).toBe(1.23);
    expect(parseDecimal('0')).toBe(0);
  });
  it('rejects bad input', () => {
    for (const s of ['1.230,5', '', '  ', '-3', '+3', 'abc', '.', '1e3']) expect(parseDecimal(s)).toBeNull();
  });
  it('converts units', () => {
    expect(toGrams(1.5, 'kg')).toBe(1500);
    expect(toGrams(1, 'lb')).toBeCloseTo(453.59237, 5);
    expect(fromGrams(toGrams(3.2, 'oz'), 'oz')).toBeCloseTo(3.2, 10);
  });
});
