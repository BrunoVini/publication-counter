import { describe, expect, it } from 'vitest';
import { identityKey, parsePastedList } from '../../src/domain/text';

describe('identityKey', () => {
  it('ignores case, accents and repeated whitespace', () => {
    expect(identityKey({ name: 'EM BUSCA DA VERDADE ', language: 'Português', variant: '' })).toBe(
      identityKey({ name: 'em busca  da verdade', language: 'portugues', variant: '' }),
    );
  });
  it('distinguishes variants', () => {
    expect(identityKey({ name: 'Bíblia', language: 'pt', variant: 'média' })).not.toBe(
      identityKey({ name: 'Bíblia', language: 'pt', variant: 'grande' }),
    );
  });
});

describe('parsePastedList', () => {
  it('parses rows, skipping blank lines and defaulting language', () => {
    expect(parsePastedList('Sentinela\tMandarim\n\nEscute a Deus\n', 'Português')).toEqual([
      { name: 'Sentinela', language: 'Mandarim', variant: '' },
      { name: 'Escute a Deus', language: 'Português', variant: '' },
    ]);
  });
  it('ignores columns beyond the third', () => {
    expect(parsePastedList('A\tPT\tbraile vol. 3\t0,099\t5', 'x')[0]).toEqual({
      name: 'A',
      language: 'PT',
      variant: 'braile vol. 3',
    });
  });
  it('handles CRLF, trims all columns and skips empty names', () => {
    expect(parsePastedList(' A \t PT \t v \r\n\t PT\r\n', 'x')).toEqual([
      { name: 'A', language: 'PT', variant: 'v' },
    ]);
  });
});
