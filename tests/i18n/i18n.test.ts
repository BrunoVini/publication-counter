import { describe, expect, test, beforeEach } from 'vitest';
import { i18n, detectLang, t, fmtNumber, fmtDate } from '../../src/i18n/index.svelte';
import pt from '../../src/i18n/pt.json';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';

beforeEach(() => { i18n.lang = 'pt'; });

describe('detectLang', () => {
  test('maps supported languages and falls back to en', () => {
    expect(detectLang(['pt-BR', 'en'])).toBe('pt');
    expect(detectLang(['de-DE'])).toBe('en');
    expect(detectLang(['es-419'])).toBe('es');
    expect(detectLang(['de', 'es'])).toBe('es');
    expect(detectLang([])).toBe('en');
  });
});

test('all locales have identical key sets', () => {
  expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
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
