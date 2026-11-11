import { describe, expect, test } from 'vitest';
import { fireEvent, screen } from '@testing-library/svelte';
import { app } from '../../src/store/app.svelte';
import { addEntry, markZero, setSample } from '../../src/domain/dataset';
import { setupPanelTests, SAMPLE, id, setup, item, panel, type } from './item-panel-helpers';

setupPanelTests();

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
    expect((screen.getByLabelText<HTMLInputElement>('Units per pack')).value).toBe('50');
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
