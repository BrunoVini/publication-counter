import { beforeAll, describe, expect, it } from 'vitest';
import { languageByName, languageName, loadLanguages, searchLanguages } from '../../src/domain/languages.svelte';
import { parsePastedList } from '../../src/domain/text';

describe('languages', () => {
  it('falls back to the raw value before loading, for legacy text and for unknown codes', async () => {
    expect(languageName('T', 'pt')).toBe('T');
    await loadLanguages();
    expect(languageName('Mandarim', 'pt')).toBe('Mandarim');
    expect(languageName('ZZZ-unknown', 'en')).toBe('ZZZ-unknown');
    expect(languageName('', 'en')).toBe('');
  });

  describe('loaded', () => {
    beforeAll(loadLanguages);
    it('localises names to the UI language', () => {
      expect(languageName('E', 'pt')).toBe('Inglês');
      expect(languageName('E', 'en')).toBe('English');
      expect(languageName('S', 'es')).toBe('español');
      expect(languageName('T', 'pt')).toBe('Português (Brasil)');
    });
    it('has the codes first run preselects', async () => {
      const all = await loadLanguages();
      expect(all.length).toBeGreaterThan(1000);
      for (const c of ['T', 'E', 'S']) expect(all.some((e) => e.c === c)).toBe(true);
    });
    it('search ignores accents and case, and finds by vernacular name and code', () => {
      expect(searchLanguages('INGLES').map((e) => e.c)).toContain('E');
      expect(searchLanguages('portugues').map((e) => e.c)).toContain('T');
      expect(searchLanguages('deutsch').map((e) => e.c)).toContain('X');
      expect(searchLanguages('Español').map((e) => e.c)).toContain('S');
      expect(searchLanguages('tmm').map((e) => e.c)).toContain('TMM');
      expect(searchLanguages('zzzzqqqq')).toEqual([]);
    });
    it('maps exact names to codes and keeps everything else raw', () => {
      expect(languageByName('inglês')).toBe('E');
      expect(languageByName('ENGLISH')).toBe('E');
      expect(languageByName('Deutsch')).toBe('X');
      expect(languageByName('Portuguese (Brazil)')).toBe('T');
      expect(languageByName('Portugu')).toBe('Portugu');
      expect(languageByName('PT')).toBe('PT');
    });
    it('paste columns map to codes while the default stays as given', () => {
      expect(parsePastedList('A\tInglês\nB\tKlingon\nC', 'S', languageByName).map((r) => r.language))
        .toEqual(['E', 'Klingon', 'S']);
    });
  });
});
