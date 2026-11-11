import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import CountScreen from '../../src/ui/count/CountScreen.svelte';
import { app } from '../../src/store/app.svelte';
import { emptyDataset, openCount, startCount } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import type { Dataset, Publication } from '../../src/domain/types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const pub = (id: string, name: string, variant = ''): Publication =>
  ({ id, name, language: 'PT', variant, defaultMode: 'weigh', archived: false });

function dataset(): Dataset {
  const ds = emptyDataset('d1', { firstRunDone: true, lastCounter: 'Ana' });
  ds.publications = [pub('a', 'Despertai!'), pub('b', 'A Sentinela'), pub('c', 'Caminho', 'Estudo'), pub('d', 'Órfãos')];
  return ds;
}
const withOpenCount = (): Dataset => {
  const ds = dataset();
  let n = 0;
  startCount(ds, 'Ana', '2026-11-11T10:00:00.000Z', () => `c${n++}`);
  return ds;
};

beforeEach(() => { i18n.lang = 'en'; app.openItemId = null; app.summaryCountId = null; app.pubDraftName = null; app.onlyNotCounted = false; app.tab = 'count'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('count screen', () => {
  test('no open count shows New count and history', () => {
    const ds = dataset();
    ds.counts = [
      { id: 'h1', startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-01T11:00:00.000Z', counter: 'Old', items: [] },
      { id: 'h2', startedAt: '2026-11-01T10:00:00.000Z', finishedAt: '2026-11-01T11:00:00.000Z', counter: 'Newer', items: [] },
    ];
    app.ds = ds;
    render(CountScreen);
    expect(screen.getByRole('button', { name: 'New count' })).toBeTruthy();
    const rows = screen.getAllByRole('button', { name: /items?/ });
    expect(rows[0].textContent).toContain('Newer');
    expect(rows[1].textContent).toContain('Old');
    void fireEvent.click(rows[0]);
    expect(app.summaryCountId).toBe('h2');
  });

  test('starting asks counter name prefilled with last', async () => {
    app.ds = dataset();
    render(CountScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'New count' }));
    const input = screen.getByLabelText<HTMLInputElement>(/^Who is counting/);
    expect(input.value).toBe('Ana');
    await fireEvent.input(input, { target: { value: '   ' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(openCount(app.ds)).toBeUndefined();
    expect(screen.getByRole('alert')).toBeTruthy();
    await fireEvent.input(input, { target: { value: 'Bia' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(openCount(app.ds)?.counter).toBe('Bia');
    expect(app.ds.settings.lastCounter).toBe('Bia');
    expect(screen.getByText('0 of 4')).toBeTruthy();
  });

  test('progress counts zero and entries as done', () => {
    const ds = withOpenCount();
    const items = openCount(ds)!.items;
    items[0].zero = true;
    items[1].entries = [{ id: 'e1', kind: 'hand', units: 12 }];
    app.ds = ds;
    render(CountScreen);
    expect(screen.getByText('2 of 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: /A Sentinela/ }).textContent).toContain('≈ 12');
    expect(screen.getByRole('button', { name: /Despertai!/ }).textContent).toContain('0');
    expect(screen.getByRole('button', { name: /Caminho/ }).textContent).toContain('Not counted');
  });

  test('item whose total throws shows needs attention instead of crashing', () => {
    const ds = withOpenCount();
    openCount(ds)!.items[0].entries = [{ id: 'e1', kind: 'weighing', weightG: 500 }];
    app.ds = ds;
    render(CountScreen);
    expect(screen.getByRole('button', { name: /Despertai!/ }).textContent).toContain('Needs attention');
  });

  test('search with no match offers create', async () => {
    app.ds = withOpenCount();
    render(CountScreen);
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'orfaos' } });
    expect(screen.getByRole('button', { name: /Órfãos/ })).toBeTruthy();
    await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'Xyz' } });
    await fireEvent.click(screen.getByRole('button', { name: "Create 'Xyz'" }));
    expect(app.pubDraftName).toBe('Xyz');
    expect(app.tab).toBe('publications');
  });

  test('not-counted filter', async () => {
    const ds = withOpenCount();
    openCount(ds)!.items[0].zero = true;
    app.ds = ds;
    render(CountScreen);
    expect(screen.getAllByRole('button', { name: /Not counted|^Despertai/ }).length).toBeGreaterThan(0);
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Only not counted' }));
    expect(screen.queryByRole('button', { name: /Despertai!/ })).toBeNull();
    expect(screen.getByRole('button', { name: /A Sentinela/ })).toBeTruthy();
  });

  test('phone: tapping a row opens the item inline; Summary button sets summaryCountId', async () => {
    app.ds = withOpenCount();
    render(CountScreen);
    await fireEvent.click(screen.getByRole('button', { name: /Caminho/ }));
    expect(app.openItemId).toBe('c');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(app.openItemId).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(app.summaryCountId).toBe(openCount(app.ds)!.id);
  });

  test('desktop keyboard: arrows select, Enter opens, Esc closes, / focuses search', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }));
    app.ds = withOpenCount();
    render(CountScreen);
    flushSync();
    await fireEvent.keyDown(window, { key: 'ArrowDown' });
    await fireEvent.keyDown(window, { key: 'ArrowDown' });
    await fireEvent.keyDown(window, { key: 'Enter' });
    expect(app.openItemId).toBe('b');
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(app.openItemId).toBeNull();
    await fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  test('Enter opens only a visible item: first match when the selection is filtered out, nothing when empty', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }));
    app.ds = withOpenCount();
    render(CountScreen);
    flushSync();
    await fireEvent.keyDown(window, { key: 'ArrowDown' }); // selects 'a'
    const search = screen.getByRole('searchbox');
    await fireEvent.input(search, { target: { value: 'sentinela' } });
    await fireEvent.keyDown(search, { key: 'Enter' });
    expect(app.openItemId).toBe('b');
    app.openItemId = null;
    await fireEvent.input(search, { target: { value: 'zzzz' } });
    await fireEvent.keyDown(search, { key: 'Enter' });
    expect(app.openItemId).toBeNull();
  });
});
