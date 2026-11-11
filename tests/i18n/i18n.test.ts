import { describe, expect, test, beforeEach, vi } from 'vitest';
import { i18n, detectLang, setLang, t, fmtNumber, fmtDate } from '../../src/i18n/index.svelte';
import pt from '../../src/i18n/pt.json';
import en from '../../src/i18n/en.json';
import { LANGS } from '../../src/domain/types';

beforeEach(() => { i18n.lang = 'pt'; });

describe('detectLang', () => {
  test('maps supported languages and falls back to en', () => {
    expect(detectLang(['pt-BR', 'en'])).toBe('pt');
    expect(detectLang(['sw-KE'])).toBe('en');
    expect(detectLang(['zh-Hans-CN'])).toBe('zh');
    expect(detectLang(['ar-EG'])).toBe('ar');
    expect(detectLang(['MR'])).toBe('mr');
    expect(detectLang(['es-419'])).toBe('es');
    expect(detectLang(['sw', 'es'])).toBe('es');
    expect(detectLang([])).toBe('en');
  });
});

const files = import.meta.glob<Record<string, string>>('../../src/i18n/*.json', { eager: true, import: 'default' });
const read = (l: string): Record<string, string> => files[`../../src/i18n/${l}.json`];
const PLURAL = /_(zero|one|two|few|many|other)$/;

describe('locale files', () => {
  test('one file per UI language', () => {
    const names = Object.keys(files).map((f) => f.split('/').pop()!.slice(0, -5));
    expect(names.sort()).toEqual([...LANGS].sort());
  });
  test.each(LANGS)('%s has every en key; only extra plural forms are allowed', (l) => {
    const base = Object.keys(en);
    const keys = Object.keys(read(l));
    expect(base.filter((k) => !keys.includes(k))).toEqual([]);
    const extra = keys.filter((k) => !(k in en));
    expect(extra.filter((k) => !PLURAL.test(k) || !base.some((b) => b.replace(PLURAL, '') === k.replace(PLURAL, '')))).toEqual([]);
  });
});

describe('lazy locales', () => {
  test('switching loads the locale, and missing keys fall back to en', async () => {
    vi.resetModules();
    const fresh = await import('../../src/i18n/index.svelte');
    fresh.i18n.lang = 'en';
    expect(fresh.t('nav.settings')).toBe(en['nav.settings' as keyof typeof en]);
    await fresh.setLang('pt');
    expect(fresh.t('nav.settings')).toBe(pt['nav.settings' as keyof typeof pt]);
    expect(fresh.t('nav.settings')).not.toBe(en['nav.settings' as keyof typeof en]);
    expect(document.documentElement.lang).toBe('pt');
    expect(document.documentElement.dir).toBe('ltr');
    const loaded = (await import('../../src/i18n/pt.json')).default as Record<string, string>;
    const saved = loaded['nav.settings'];
    delete loaded['nav.settings'];
    expect(fresh.t('nav.settings')).toBe(en['nav.settings' as keyof typeof en]);
    loaded['nav.settings'] = saved;
  });
  test('right-to-left languages set dir', async () => {
    await setLang('ar');
    expect(document.documentElement.dir).toBe('rtl');
    await setLang('ur');
    expect(document.documentElement.dir).toBe('rtl');
    await setLang('pt');
    expect(document.documentElement.dir).toBe('ltr');
  });
  test('plural forms beyond one/other fall back to _other', async () => {
    await setLang('ru');
    const d = read('ru');
    d['z.item_few'] = '{count} few'; d['z.item_other'] = '{count} other';
    expect(t('z.item', { count: 3 })).toBe('3 few');
    expect(t('z.item', { count: 5 })).toBe('5 other');
    delete d['z.item_few']; delete d['z.item_other'];
  });
});

describe('t', () => {
  test('interpolates', () => { expect(t('count.progress', { done: 23, total: 51 })).toBe('23 de 51'); });
  test('follows the language', () => {
    i18n.lang = 'en';
    expect(t('nav.settings')).toBe(en['nav.settings' as keyof typeof en]);
  });
  test('missing key returns the key', () => { expect(t('nope.nothing')).toBe('nope.nothing'); });
  test('plural selection with fallbacks', () => {
    const d = en as Record<string, string>;
    d['x.item_one'] = '{count} item'; d['x.item_other'] = '{count} items'; d['x.only'] = 'base';
    d['x.only_other'] = 'other';
    d['y.base'] = 'base {count}';
    i18n.lang = 'en';
    expect(t('x.item', { count: 1 })).toBe('1 item');
    expect(t('x.item', { count: 3 })).toBe('3 items');
    expect(t('y.base', { count: 3 })).toBe('base 3');
    delete d['x.item_one']; delete d['x.item_other']; delete d['x.only']; delete d['x.only_other']; delete d['y.base'];
  });
});

describe('formatting', () => {
  test('fmtNumber follows language', () => {
    expect(fmtNumber(5280)).toBe('5.280');
    expect(fmtNumber(1.23456, 2)).toBe('1,23');
    i18n.lang = 'en';
    expect(fmtNumber(5280)).toBe('5,280');
  });
  test('fmtDate handles date-only without day shift, full ISO, and invalid', () => {
    expect(fmtDate('2026-11-01')).toBe('01/11/2026');
    expect(fmtDate('2026-11-01T12:00:00Z')).toBe('01/11/2026');
    expect(fmtDate('garbage')).toBe('garbage');
  });
});

describe('setLang failure', () => {
  test('falls back to en when the locale chunk cannot load', async () => {
    vi.resetModules();
    vi.doMock('../../src/i18n/fr.json', () => { throw new Error('offline'); });
    const fresh = await import('../../src/i18n/index.svelte');
    expect(await fresh.setLang('fr')).toBe('en');
    expect(fresh.i18n.lang).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(fresh.t('nav.settings')).toBe(en['nav.settings' as keyof typeof en]);
    vi.doUnmock('../../src/i18n/fr.json');
    vi.resetModules();
  });
});
