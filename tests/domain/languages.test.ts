import { beforeAll, describe, expect, it } from 'vitest';
import { languageByName, languageName, loadLanguages, searchLanguages } from '../../src/domain/languages.svelte';
import { setLang } from '../../src/i18n/index.svelte';
import { parsePastedList } from '../../src/domain/text';

describe('languages', () => {
  it('falls back to the raw value before loading, for legacy text and for unknown codes', async () => {
    await setLang('pt');
    expect(languageName('T')).toBe('T');
    await loadLanguages();
    expect(languageName('Mandarim')).toBe('Mandarim');
    expect(languageName('ZZZ-unknown')).toBe('ZZZ-unknown');
    expect(languageName('')).toBe('');
  });

  describe('loaded', () => {
    beforeAll(async () => { await setLang('pt'); await loadLanguages(); });
    it('localises names to the current UI language, following changes', async () => {
      expect(languageName('E')).toBe('Inglês');
      expect(languageName('T')).toBe('Português (Brasil)');
      await setLang('es');
      await loadLanguages();
      expect(languageName('S')).toBe('español');
      await setLang('de');
      await loadLanguages();
      expect(languageName('E')).toBe('Englisch');
      await setLang('en');
      await loadLanguages();
      expect(languageName('E')).toBe('English');
      await setLang('pt');
    });
    it('has the codes first run preselects', async () => {
      const all = await loadLanguages();
      expect(all.length).toBeGreaterThan(1000);
      for (const c of ['T', 'E', 'S']) expect(all.some((e) => e.c === c)).toBe(true);
    });
    it('search ignores accents and case, and finds by localised, vernacular and English name and code', () => {
      expect(searchLanguages('INGLES').map((e) => e.c)).toContain('E');
      expect(searchLanguages('portugues').map((e) => e.c)).toContain('T');
      expect(searchLanguages('deutsch').map((e) => e.c)).toContain('X');
      expect(searchLanguages('Español').map((e) => e.c)).toContain('S');
      expect(searchLanguages('german').map((e) => e.c)).toContain('X');
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
