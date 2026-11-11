import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Toast from '../../src/ui/shared/Toast.svelte';
import { flushSync } from 'svelte';
import ItemPanel from '../../src/ui/count/ItemPanel.svelte';
import ScaleEditor from '../../src/ui/settings/ScaleEditor.svelte';
import { app } from '../../src/store/app.svelte';
import { addEntry, emptyDataset, markZero, openCount, setSample, startCount } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import type { Dataset, Sample } from '../../src/domain/types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

// Unit weight 2 g (10 units, 20 g).
const SAMPLE: Sample = { units: 10, weightG: 20 };
let n = 0;
const id = () => `id${n++}`;

function setup(opts: { sample?: Sample; unit?: 'g' | 'kg' } = { sample: SAMPLE }): Dataset {
  const ds = emptyDataset('d1', { firstRunDone: true, unit: opts.unit ?? 'g' });
  ds.publications = [
    { id: 'p', name: 'Awake', language: 'EN', variant: '', sample: opts.sample, defaultMode: 'weigh', archived: false },
    { id: 'q', name: 'Other', language: 'EN', variant: '', sample: { units: 5, weightG: 50 }, defaultMode: 'weigh', archived: false },
  ];
  startCount(ds, 'Ana', '2026-11-11T10:00:00.000Z', () => 'c1');
  app.ds = ds;
  return ds;
}
const item = () => openCount(app.ds)!.items.find((i) => i.publicationId === 'p')!;
const panel = () => render(ItemPanel, { countId: 'c1', pubId: 'p' });
const type = (label: string | RegExp, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });

beforeEach(() => { i18n.lang = 'en'; app.openItemId = null; app.tab = 'count'; n = 0; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('item panel', () => {
  test('add via button converts unit and updates total', async () => {
    setup({ sample: SAMPLE, unit: 'kg' });
    panel();
    await type('Add weighing', '1,2');
    expect(screen.getByText(/= ≈ 600 un/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    const e = item().entries[0];
    expect(e).toMatchObject({ kind: 'weighing', weightG: 1200 });
    expect(screen.getByText(/≈ 600/, { selector: '.total' })).toBeTruthy();
  });

  test('Enter adds the same as button', async () => {
    setup();
    panel();
    await type('Add weighing', '1230');
    await fireEvent.keyDown(screen.getByLabelText('Add weighing'), { key: 'Enter' });
    expect(item().entries).toHaveLength(1);
    expect(item().entries[0]).toMatchObject({ kind: 'weighing', weightG: 1230 });
  });

  test('over capacity blocks', async () => {
    const ds = setup();
    ds.settings.scale = [{ upToG: 1000, resolutionG: 1 }];
    panel();
    await type('Add weighing', '1500');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(item().entries).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toMatch(/capacity/i);
  });

  test('below-one-unit asks confirmation', async () => {
    setup();
    panel();
    await type('Add weighing', '1.23');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(item().entries).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toMatch(/lighter than one unit/i);
    await fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));
    expect(item().entries).toHaveLength(1);
  });

  test('delete asks confirmation', async () => {
    setup();
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 2027 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(item().entries).toHaveLength(1);
    expect(screen.getByText('Delete the 2,027 g weighing?')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(item().entries).toHaveLength(0);
  });

  test('undo removes last added', async () => {
    setup();
    panel();
    await type('Add weighing', '100');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(item().entries).toHaveLength(1);
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(item().entries).toHaveLength(0);
  });

  test('edit shows old value and new total', async () => {
    setup();
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 2000 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    expect(screen.getByText('Was: 2,000 g')).toBeTruthy();
    await type('Weight (g)', '1000');
    expect(screen.getByText(/New total: ≈ 500/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(item().entries[0]).toMatchObject({ weightG: 1000 });
  });

  test('no sample shows sample form with advice', async () => {
    setup({ sample: undefined });
    app.ds.settings.scale = [{ upToG: 1000, resolutionG: 1 }];
    panel();
    await type(/^Units in the sample/, '10');
    await type(/^Sample weight \(g\)/, '20');
    expect(screen.getByText(/at least 100 units/)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Save sample' }));
    expect(item().sample).toEqual({ units: 10, weightG: 20 });
    expect(screen.getByText(/Keep these 10 units aside/)).toBeTruthy();
  });

  test('no sample and no scale offers the scale step, set up later keeps null', async () => {
    setup({ sample: undefined });
    panel();
    expect(screen.getByText('Set up your scale')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Set up later' }));
    expect(app.ds.settings.scale).toBeNull();
    expect(screen.getByLabelText(/^Units in the sample/)).toBeTruthy();
  });

  test('redo sample shows old-units warning', async () => {
    setup();
    setSample(app.ds, 'c1', 'p', SAMPLE, id);
    panel();
    await fireEvent.click(screen.getAllByRole('button', { name: 'Re-weigh sample' })[0]);
    await type(/^Units in the sample/, '10');
    await type(/^Sample weight \(g\)/, '30');
    await fireEvent.click(screen.getByRole('button', { name: 'Save sample' }));
    expect(screen.getByText(/units of the old sample/i)).toBeTruthy();
    expect(item().sample).toEqual({ units: 10, weightG: 30 });
  });

  test('zero button marks counted 0', async () => {
    setup();
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'None here (0)' }));
    expect(item().zero).toBe(true);
    expect(screen.getByText('0', { selector: '.total' })).toBeTruthy();
  });

  test('sealed uses packSize and updates it', async () => {
    const ds = setup();
    ds.publications[0].packSize = 50;
    panel();
    await fireEvent.click(screen.getByRole('tab', { name: 'Sealed' }));
    expect((screen.getByLabelText('Units per pack') as HTMLInputElement).value).toBe('50');
    await type('Packs', '3');
    await type('Units per pack', '40');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(item().entries[0]).toMatchObject({ kind: 'sealed', packs: 3, perPack: 40 });
    expect(app.ds.publications[0].packSize).toBe(40);
  });

  test('finished count is read-only', () => {
    setup();
    addEntry(app.ds, 'c1', 'p', { kind: 'hand', units: 5 }, id);
    app.ds.counts[0].finishedAt = '2026-11-11T12:00:00.000Z';
    panel();
    expect(screen.queryByRole('button', { name: '+ Add' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'None here (0)' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete entry' })).toBeNull();
  });

  test('unit label opens settings', async () => {
    setup();
    panel();
    await fireEvent.click(screen.getByRole('button', { name: /Weight unit: g/ }));
    expect(app.tab).toBe('settings');
  });

  test('exact-only total needs no sample', () => {
    setup({ sample: undefined });
    markZero(app.ds, 'c1', 'p');
    panel();
    expect(screen.getByText('0', { selector: '.total' })).toBeTruthy();
  });
});

describe('item panel guards', () => {
  test('pending Add anyway is cleared on tab switch and on entry change', async () => {
    setup();
    panel();
    await type('Add weighing', '1.23');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByRole('button', { name: 'Add anyway' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('tab', { name: 'Sealed' }));
    await fireEvent.click(screen.getByRole('tab', { name: 'Weigh' }));
    expect(screen.queryByRole('button', { name: 'Add anyway' })).toBeNull();
    await type('Add weighing', '1.23');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    addEntry(app.ds, 'c1', 'p', { kind: 'hand', units: 3 }, id);
    flushSync();
    expect(screen.queryByRole('button', { name: 'Add anyway' })).toBeNull();
  });

  test('edit with a dot-thousands typo asks confirmation', async () => {
    setup();
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 1230 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    await type('Weight (g)', '1.230');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(item().entries[0]).toMatchObject({ weightG: 1230 });
    expect(screen.getByRole('alert').textContent).toMatch(/lighter than one unit/i);
    await fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    expect(item().entries[0]).toMatchObject({ weightG: 1.23 });
  });

  test('edit over capacity is blocked', async () => {
    const ds = setup();
    ds.settings.scale = [{ upToG: 1000, resolutionG: 1 }];
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 500 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    await type('Weight (g)', '1500');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(item().entries[0]).toMatchObject({ weightG: 500 });
    expect(screen.getByRole('alert').textContent).toMatch(/capacity/i);
  });

  test('unchanged edit skips the update and pt prefill uses a comma', async () => {
    i18n.lang = 'pt';
    setup();
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 1500.5 }, id);
    panel();
    const before = item().entries[0];
    await fireEvent.click(screen.getByRole('button', { name: 'Editar lançamento' }));
    expect((screen.getByLabelText('Peso (g)') as HTMLInputElement).value).toBe('1500,5');
    await fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(item().entries[0]).toBe(before);
  });

  test('edit round-trip in kg', async () => {
    setup({ sample: SAMPLE, unit: 'kg' });
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 1200 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('1.2');
    await type('Weight (kg)', '1,5');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(item().entries[0]).toMatchObject({ weightG: 1500 });
  });

  test('toast Undo removes exactly its own entry', async () => {
    setup();
    render(Toast);
    panel();
    await type('Add weighing', '100');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    const own = item().entries[0].id;
    addEntry(app.ds, 'c1', 'p', { kind: 'hand', units: 3 }, id);
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(item().entries.map((e) => e.kind)).toEqual(['hand']);
    expect(item().entries.some((e) => e.id === own)).toBe(false);
  });

  test('Ctrl+Z is ignored while a dialog is open', async () => {
    setup();
    panel();
    await type('Add weighing', '100');
    await fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    const d = document.createElement('dialog');
    d.setAttribute('open', '');
    document.body.appendChild(d);
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    d.remove();
    expect(item().entries).toHaveLength(1);
  });
});

describe('scale editor', () => {
  test('shows a message for an invalid scale', async () => {
    const onsave = vi.fn();
    render(ScaleEditor, { scale: [{ upToG: 1000, resolutionG: 1 }, { upToG: 500, resolutionG: 1 }], onsave, oncancel: () => {} });
    await fireEvent.click(screen.getByRole('button', { name: 'Save scale' }));
    expect(onsave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/ascending/i);
  });

  test('saves grams from the user unit', async () => {
    setup({ sample: SAMPLE, unit: 'kg' });
    const onsave = vi.fn();
    render(ScaleEditor, { scale: [{ upToG: 1000, resolutionG: 1 }], onsave, oncancel: () => {} });
    expect((screen.getByLabelText(/^Up to \(kg\)/) as HTMLInputElement).value).toBe('1');
    await type(/^Up to \(kg\)/, '2');
    await fireEvent.click(screen.getByRole('button', { name: 'Save scale' }));
    expect(onsave).toHaveBeenCalledWith([{ upToG: 2000, resolutionG: 1 }]);
  });
});
