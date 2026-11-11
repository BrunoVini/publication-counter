import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createStore } from 'idb-keyval';

vi.mock('../../src/ui/shared/fileio', async (orig) => {
  const real = await orig<typeof import('../../src/ui/shared/fileio')>();
  return { ...real, pickTextFile: vi.fn(), shareOrDownload: vi.fn(async () => undefined) };
});

import SettingsScreen from '../../src/ui/settings/SettingsScreen.svelte';
import ScaleEditor from '../../src/ui/settings/ScaleEditor.svelte';
import { app, flushSaves } from '../../src/store/app.svelte';
import { set } from 'idb-keyval';
import { setStore, listBackups } from '../../src/store/persist';
import { emptyDataset } from '../../src/domain/dataset';
import { serializeDataset } from '../../src/domain/file';
import { i18n } from '../../src/i18n/index.svelte';
import { pickTextFile, shareOrDownload } from '../../src/ui/shared/fileio';
import type { Dataset } from '../../src/domain/types';

let n = 0;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  setStore(createStore(`st${n++}`, 'kv'));
  app.ds = emptyDataset('cur', { firstRunDone: true });
  i18n.lang = 'en';
  vi.mocked(pickTextFile).mockReset();
});
afterEach(async () => { cleanup(); await flushSaves(); delete document.documentElement.dataset.theme; });

const withPub = (id: string): Dataset => {
  const ds = emptyDataset(id, { firstRunDone: true });
  ds.publications = [{ id: 'p', name: 'Alpha', language: 'English', variant: '', defaultMode: 'hand', archived: false }];
  return ds;
};

describe('scale editor', () => {
  test('rejects decreasing resolution', async () => {
    const onsave = vi.fn();
    render(ScaleEditor, { scale: [], onsave, oncancel: () => undefined });
    await fireEvent.click(screen.getByRole('button', { name: '+ Add range' }));
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const vals = ['100', '1', '200', '0.5'];
    for (let i = 0; i < 4; i++) await fireEvent.input(inputs[i], { target: { value: vals[i] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save scale' }));
    expect(onsave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('cannot decrease');
  });
  test('converts units to grams', async () => {
    app.ds.settings.unit = 'kg';
    const onsave = vi.fn();
    render(ScaleEditor, { scale: [], onsave, oncancel: () => undefined });
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    await fireEvent.input(inputs[0], { target: { value: '1' } });
    await fireEvent.input(inputs[1], { target: { value: '0.5' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save scale' }));
    expect(onsave).toHaveBeenCalledWith([{ upToG: 1000, resolutionG: 500 }]);
  });
});

describe('settings screen', () => {
  test('theme switch sets data-theme', async () => {
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(app.ds.settings.theme).toBe('dark');
    await fireEvent.click(screen.getByRole('radio', { name: 'Use device setting' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  test('language switch updates i18n and settings', async () => {
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('radio', { name: 'Español' }));
    expect(i18n.lang).toBe('es');
    expect(app.ds.settings.language).toBe('es');
  });

  test('open file with existing data asks confirmation and backs up', async () => {
    app.ds = withPub('cur');
    const incoming = emptyDataset('incoming', { firstRunDone: true });
    vi.mocked(pickTextFile).mockResolvedValue(serializeDataset(incoming));
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'Open received file' }));
    await screen.findByRole('heading', { name: 'Replace current data?' });
    expect(app.ds.datasetId).toBe('cur');
    await fireEvent.click(screen.getByRole('button', { name: 'Replace data' }));
    await waitFor(() => expect(app.ds.datasetId).toBe('incoming'));
    const backups = await listBackups();
    expect(backups[0].dataset.datasetId).toBe('cur');
  });

  test('invalid file leaves data unchanged', async () => {
    app.ds = withPub('cur');
    vi.mocked(pickTextFile).mockResolvedValue('{"nope":1}');
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'Open received file' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not a valid'));
    expect(app.ds.datasetId).toBe('cur');
    expect(await listBackups()).toEqual([]);
  });

  test('hand over shares the serialized file', async () => {
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'Hand over data to another person' }));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalled());
    expect(vi.mocked(shareOrDownload).mock.calls[0][2]).toBe('application/json');
  });

  test('restore a backup asks confirmation and replaces data', async () => {
    app.ds = withPub('old');
    const { replaceDataset } = await import('../../src/store/app.svelte');
    await replaceDataset(emptyDataset('new', { firstRunDone: true }), 'test');
    render(SettingsScreen);
    await fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Restore backup' }));
    await waitFor(() => expect(app.ds.datasetId).toBe('old'));
  });

  test('empty backup list says so', async () => {
    render(SettingsScreen);
    expect(await screen.findByText('No backups yet')).toBeTruthy();
  });

  test('clear scale resets it to null after confirm', async () => {
    app.ds.settings.scale = [{ upToG: 1000, resolutionG: 1 }];
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'Clear scale' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(app.ds.settings.scale).toBeNull();
  });

  test('location name is trimmed and empty becomes undefined', async () => {
    render(SettingsScreen);
    const input = screen.getByLabelText('Location name');
    await fireEvent.input(input, { target: { value: '  Centro ' } });
    await fireEvent.change(input);
    expect(app.ds.settings.locationName).toBe('Centro');
    await fireEvent.input(input, { target: { value: '  ' } });
    await fireEvent.change(input);
    expect(app.ds.settings.locationName).toBeUndefined();
  });

  test('how it works shows the pilot numbers', async () => {
    render(SettingsScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(document.body.textContent).toContain('489 g / 200 = 2.445 g');
    expect(document.body.textContent).toContain('5,280');
  });
});

describe('unreadable data export', () => {
  test('hidden without a corrupt payload', async () => {
    render(SettingsScreen);
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Export unreadable data' })).toBeNull();
  });

  test('shown when a corrupt payload exists and shares it as JSON', async () => {
    const store = createStore(`cx${n++}`, 'kv');
    setStore(store);
    await set('corrupt', { junk: 1 }, store);
    vi.mocked(shareOrDownload).mockClear();
    render(SettingsScreen);
    await fireEvent.click(await screen.findByRole('button', { name: 'Export unreadable data' }));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalled());
    const [name, text, mime] = vi.mocked(shareOrDownload).mock.calls[0];
    expect(name).toMatch(/\.json$/);
    expect(JSON.parse(text as string)).toEqual({ junk: 1 });
    expect(mime).toBe('application/json');
  });
});
