import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import App from '../../src/ui/App.svelte';
import { app, flushSaves } from '../../src/store/app.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { i18n, setLang } from '../../src/i18n/index.svelte';
import { serializeDataset } from '../../src/domain/file';
import { createStore } from 'idb-keyval';
import { setStore } from '../../src/store/persist';
import { loadLanguages } from '../../src/domain/languages.svelte';
import { openPubcountText, pickTextFile } from '../../src/ui/shared/fileio';

vi.mock('../../src/ui/shared/fileio', async (orig) => {
  const real = await orig<typeof import('../../src/ui/shared/fileio')>();
  return {
  ...real,
  pickTextFile: vi.fn(),
  openPubcountText: vi.fn(real.openPubcountText),
  };
});

vi.mock('../../src/i18n/index.svelte', async (orig) => {
  const real = await orig<typeof import('../../src/i18n/index.svelte')>();
  return { ...real, setLang: vi.fn(real.setLang) };
});

let n = 0;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

beforeEach(async () => {
  await loadLanguages();
  setStore(createStore(`fr${n++}`, 'kv')); app.ds = emptyDataset('first'); app.tab = 'settings'; app.pasteOpen = false; i18n.lang = 'pt'; });
afterEach(async () => { cleanup(); await flushSaves(); i18n.lang = 'en'; app.tab = 'count'; });

describe('first run', () => {
  test('first run shown when firstRunDone is false', () => {
    render(App);
    expect(screen.getByRole('heading', { name: 'Bem-vindo ao PubCount' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  test('choosing English sets lang and unit persists', async () => {
    render(App);
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    await waitFor(() => expect(i18n.lang).toBe('en'));
    expect(app.ds.settings.language).toBe('en');
    await fireEvent.click(screen.getByRole('radio', { name: 'oz' }));
    expect(app.ds.settings.unit).toBe('oz');
  });

  test('start empty finishes first run and lands on count', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Começar vazio' }));
    expect(app.ds.settings.firstRunDone).toBe(true);
    expect(app.tab).toBe('count');
  });

  test('paste list flags the publications tab', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Colar lista' }));
    expect(app.ds.settings.firstRunDone).toBe(true);
    expect([app.tab, app.pasteOpen]).toEqual(['publications', true]);
  });

  test('opening an invalid file shows error and keeps data', async () => {
    vi.mocked(pickTextFile).mockResolvedValue('{"nope":1}');
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Abrir arquivo recebido' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/danificado/));
    expect(app.ds.datasetId).toBe('first');
    expect(app.ds.settings.firstRunDone).toBe(false);
  });

  test('opening a valid file takes its data and finishes', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(serializeDataset(emptyDataset('received', { unit: 'lb' })));
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Abrir arquivo recebido' }));
    await waitFor(() => expect(app.ds.datasetId).toBe('received'));
    await waitFor(() => expect(app.ds.settings.firstRunDone).toBe(true));
    expect(app.ds.settings.unit).toBe('lb');
  });

  test('moving to the next step focuses its heading', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 })));
  });

  test('choosing a language keeps a unit the user already picked', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('radio', { name: 'oz' }));
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    await waitFor(() => expect(i18n.lang).toBe('en'));
    expect(app.ds.settings.unit).toBe('oz');
    expect((screen.getByRole<HTMLInputElement>('radio', { name: 'oz' })).checked).toBe(true);
  });

  test('a language that fails to load is not persisted', async () => {
    vi.mocked(setLang).mockImplementationOnce(async () => 'en');
    render(App);
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fr' } });
    await waitFor(() => expect(setLang).toHaveBeenCalledWith('fr'));
    await flushSaves();
    expect(app.ds.settings.language).not.toBe('fr');
  });

  test('a file from a newer version shows the error and keeps data', async () => {
    vi.mocked(pickTextFile).mockResolvedValue(JSON.stringify({ formatVersion: 2 }));
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Abrir arquivo recebido' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/versão mais nova/));
    expect(app.ds.datasetId).toBe('first');
    expect(app.ds.settings.firstRunDone).toBe(false);
  });

  test('a failed backup shows the message and keeps data', async () => {
    vi.mocked(pickTextFile).mockResolvedValue('{}');
    vi.mocked(openPubcountText).mockRejectedValueOnce('backupFailed');
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Abrir arquivo recebido' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/backup/));
    expect(app.ds.datasetId).toBe('first');
    expect(app.ds.settings.firstRunDone).toBe(false);
  });

  test('the primary publication language is preselected from the UI language and saved', async () => {
    render(App);
    expect((await screen.findByRole<HTMLInputElement>('radio', { name: 'Português (Brasil)' })).checked).toBe(true);
    await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } });
    await waitFor(() => expect(i18n.lang).toBe('en'));
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(app.ds.settings.pubLanguage).toBe('E');
    expect(app.ds.settings.pubLanguages).toEqual([]);
  });

  test('secondary languages are saved and optional', async () => {
    render(App);
    await screen.findByRole('radio', { name: 'Português (Brasil)' });
    await fireEvent.input(screen.getAllByRole('searchbox')[1], { target: { value: 'ingles' } });
    await fireEvent.click(screen.getByRole('checkbox', { name: /^Inglês(·|$)/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(app.ds.settings.pubLanguage).toBe('T');
    expect(app.ds.settings.pubLanguages).toEqual(['E']);
  });
});
