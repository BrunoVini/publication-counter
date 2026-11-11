import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import PublicationsScreen from '../../src/ui/publications/PublicationsScreen.svelte';
import Toast from '../../src/ui/shared/Toast.svelte';
import { app } from '../../src/store/app.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import { loadLanguages } from '../../src/domain/languages.svelte';
import type { Publication } from '../../src/domain/types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const pub = (id: string, name: string, language = 'PT', variant = '', archived = false): Publication =>
  ({ id, name, language, variant, defaultMode: 'weigh', archived });

beforeEach(async () => {
  await loadLanguages();
  i18n.lang = 'en';
  app.ds = emptyDataset('d1', { firstRunDone: true });
  app.ds.publications = [pub('a', 'Awake!'), pub('o', 'Old', 'PT', '', true)];
  app.pasteOpen = false; app.pubDraftName = null; app.tab = 'publications';
});
afterEach(cleanup);

const type = (label: RegExp | string, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

describe('publications screen', () => {
  test('add publication rejects duplicate inline', async () => {
    app.ds.settings.pubLanguage = 'PT';
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    await type(/^Name/, 'awake!');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('already exists');
    expect(app.ds.publications.length).toBe(2);
    await type(/^Variant/, 'Study');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications.length).toBe(3);
    expect(app.ds.publications[2].variant).toBe('Study');
  });

  test('sample needs both fields and is stored in grams', async () => {
    app.ds.settings.unit = 'kg';
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    await type(/^Name/, 'Tract');
    await type(/^Units in sample/, '10');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications.length).toBe(2);
    await type(/^Sample weight/, '0,5');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications[2].sample).toEqual({ units: 10, weightG: 500 });
  });

  test('draft name from the count screen opens a prefilled form', () => {
    app.pubDraftName = 'Brochure';
    render(PublicationsScreen);
    expect((screen.getByLabelText<HTMLInputElement>(/^Name/)).value).toBe('Brochure');
    expect(app.pubDraftName).toBeNull();
  });

  test('paste preview marks duplicates and adds the rest', async () => {
    render(PublicationsScreen);
    render(Toast);
    await fireEvent.click(screen.getByRole('button', { name: 'Paste list' }));
    const dlg = within(screen.getByRole('dialog', { hidden: true, name: 'Paste list' }));
    await fireEvent.input(dlg.getByLabelText(/^List/), {
      target: { value: 'Awake!\tPT\nNew one\tPT\nnew one\tPT\nOld\tPT' },
    });
    flushSync();
    expect(dlg.getAllByText('Already in catalogue').length).toBe(1);
    expect(dlg.getAllByText('Duplicate in paste').length).toBe(1);
    // archived entries count as absent
    expect(dlg.getAllByText('New').length).toBe(2);
    await fireEvent.click(dlg.getByRole('button', { name: /^Add 2/ }));
    expect(app.ds.publications.map((p) => p.name)).toEqual(['Awake!', 'Old', 'New one', 'Old']);
    expect(await screen.findByText('2 added')).toBeTruthy();
  });

  test('archive and restore', async () => {
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: /Awake!/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(app.ds.publications[0].archived).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: /Archived \(2\)/ }));
    // a live duplicate of "Old" blocks its restore, shown inline
    app.ds.publications.push(pub('n', 'Old'));
    flushSync();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[1]);
    expect(screen.getByRole('alert').textContent).toContain('already exists');
    await fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0]);
    expect(app.ds.publications[0].archived).toBe(false);
  });

  test('editing without touching the sample keeps the stored grams exactly', async () => {
    app.ds.settings.unit = 'lb';
    app.ds.publications[0].sample = { units: 7, weightG: 123.456789 };
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: /Awake!/ }));
    await type(/^Name/, 'Awake! 2');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications[0].name).toBe('Awake! 2');
    expect(app.ds.publications[0].sample).toEqual({ units: 7, weightG: 123.456789 });
  });

  test('editing the sample weight re-converts it', async () => {
    app.ds.settings.unit = 'kg';
    app.ds.publications[0].sample = { units: 7, weightG: 123.456789 };
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: /Awake!/ }));
    await type(/^Sample weight/, '0,5');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications[0].sample).toEqual({ units: 7, weightG: 500 });
  });

  test('the form preselects the primary language, then offers the secondary ones', async () => {
    app.ds.settings.pubLanguage = 'T';
    app.ds.settings.pubLanguages = ['E', 'S'];
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    const sel = screen.getByLabelText<HTMLSelectElement>('Language');
    expect(sel.value).toBe('T');
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Portuguese (Brazil)', 'English', 'Spanish', 'Other language…']);
  });

  test('a language picked via Other can be added to the secondary languages', async () => {
    app.ds.settings.pubLanguage = 'T';
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: '+ New' }));
    await type(/^Name/, 'Tract');
    await fireEvent.change(screen.getByLabelText('Language'), { target: { value: '\u0000other' } });
    const dlg = within(screen.getByRole('dialog', { name: 'Choose a language', hidden: true }));
    await fireEvent.input(dlg.getByRole('searchbox'), { target: { value: 'german' } });
    await fireEvent.click(dlg.getByRole('radio', { name: /^German(·|$)/ }));
    await fireEvent.click(dlg.getByRole('checkbox', { name: /add it to my other/ }));
    await fireEvent.click(dlg.getByRole('button', { name: 'Use this language' }));
    expect((screen.getByLabelText<HTMLSelectElement>('Language')).value).toBe('X');
    expect(app.ds.settings.pubLanguages).toEqual(['X']);
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(app.ds.publications[2].language).toBe('X');
  });

  test('legacy free-text languages display raw and stay selected when editing', async () => {
    app.ds.settings.pubLanguage = 'T';
    app.ds.publications = [pub('l', 'Old tract', 'Mandarim'), pub('c', 'Coded', 'E')];
    render(PublicationsScreen);
    expect(screen.getByRole('button', { name: /Old tract/ }).textContent).toContain('Mandarim');
    expect(screen.getByRole('button', { name: /Coded/ }).textContent).toContain('English');
    await fireEvent.click(screen.getByRole('button', { name: /Old tract/ }));
    const sel = screen.getByLabelText<HTMLSelectElement>('Language');
    expect(sel.value).toBe('Mandarim');
    expect(sel.selectedOptions[0].textContent).toBe('Mandarim');
  });

  test('searching matches the displayed language name', async () => {
    app.ds.publications = [pub('c', 'Coded', 'E'), pub('d', 'Other', 'X')];
    render(PublicationsScreen);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'english' } });
    expect(screen.queryByRole('button', { name: /Other/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Coded/ })).toBeTruthy();
  });

  test('paste list preselects the primary language and maps exact names to codes', async () => {
    app.ds.settings.pubLanguage = 'S';
    render(PublicationsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'Paste list' }));
    const dlg = within(screen.getByRole('dialog', { hidden: true, name: 'Paste list' }));
    expect((dlg.getByLabelText<HTMLSelectElement>('Default language')).value).toBe('S');
    await fireEvent.input(dlg.getByLabelText(/^List/), { target: { value: 'One\tInglês\nTwo\tKlingon\nThree' } });
    flushSync();
    await fireEvent.click(dlg.getByRole('button', { name: /^Add 3/ }));
    expect(app.ds.publications.slice(-3).map((p) => p.language)).toEqual(['E', 'Klingon', 'S']);
  });
});
