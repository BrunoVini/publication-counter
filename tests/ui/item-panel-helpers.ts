import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ItemPanel from '../../src/ui/count/ItemPanel.svelte';
import { app } from '../../src/store/app.svelte';
import { emptyDataset, openCount, startCount } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';
import type { Dataset, Sample } from '../../src/domain/types';

/** Registers the shared dialog stubs and per-test reset; call once at the top of a test file. */
export function setupPanelTests(): void {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  });
  beforeEach(() => { i18n.lang = 'en'; app.openItemId = null; app.tab = 'count'; n = 0; });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
}

// Unit weight 2 g (10 units, 20 g).
export const SAMPLE: Sample = { units: 10, weightG: 20 };
let n = 0;
export const id = () => `id${n++}`;

export function setup(opts: { sample?: Sample; unit?: 'g' | 'kg' } = { sample: SAMPLE }): Dataset {
  const ds = emptyDataset('d1', { firstRunDone: true, unit: opts.unit ?? 'g' });
  ds.publications = [
    { id: 'p', name: 'Awake', language: 'EN', variant: '', sample: opts.sample, defaultMode: 'weigh', archived: false },
    { id: 'q', name: 'Other', language: 'EN', variant: '', sample: { units: 5, weightG: 50 }, defaultMode: 'weigh', archived: false },
  ];
  startCount(ds, 'Ana', '2026-11-11T10:00:00.000Z', () => 'c1');
  app.ds = ds;
  return ds;
}
export const item = () => openCount(app.ds)!.items.find((i) => i.publicationId === 'p')!;
export const panel = () => render(ItemPanel, { countId: 'c1', pubId: 'p' });
export const type = (label: string | RegExp, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
