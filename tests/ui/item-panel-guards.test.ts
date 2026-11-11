import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Toast from '../../src/ui/shared/Toast.svelte';
import { flushSync } from 'svelte';
import ScaleEditor from '../../src/ui/settings/ScaleEditor.svelte';
import { app } from '../../src/store/app.svelte';
import { addEntry } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import { setupPanelTests, SAMPLE, id, setup, item, panel, type } from './item-panel-helpers';

setupPanelTests();

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
    expect((screen.getByLabelText<HTMLInputElement>('Peso (g)')).value).toBe('1500,5');
    await fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(item().entries[0]).toBe(before);
  });

  test('edit round-trip in kg', async () => {
    setup({ sample: SAMPLE, unit: 'kg' });
    addEntry(app.ds, 'c1', 'p', { kind: 'weighing', weightG: 1200 }, id);
    panel();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit entry' }));
    expect((screen.getByLabelText<HTMLInputElement>('Weight (kg)')).value).toBe('1.2');
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
    expect((screen.getByLabelText<HTMLInputElement>(/^Up to \(kg\)/)).value).toBe('1');
    await type(/^Up to \(kg\)/, '2');
    await fireEvent.click(screen.getByRole('button', { name: 'Save scale' }));
    expect(onsave).toHaveBeenCalledWith([{ upToG: 2000, resolutionG: 1 }]);
  });
});

