import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import App from '../../src/ui/App.svelte';
import { app, flushSaves } from '../../src/store/app.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import { serializeDataset } from '../../src/domain/file';
import { createStore } from 'idb-keyval';
import { setStore } from '../../src/store/persist';
import { pickTextFile } from '../../src/ui/shared/fileio';

vi.mock('../../src/ui/shared/fileio', async (orig) => ({
  ...(await orig<typeof import('../../src/ui/shared/fileio')>()),
  pickTextFile: vi.fn(),
}));

let n = 0;
beforeEach(() => {
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
    await fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(i18n.lang).toBe('en');
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
});
