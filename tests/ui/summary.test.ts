import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';

const toBlob = vi.fn(async () => new Blob(['x']));
const writeXlsxFile = vi.fn((_data: unknown, _opts?: unknown) => ({ toBlob }));
vi.mock('write-excel-file/browser', () => ({ default: writeXlsxFile }));
vi.mock('../../src/ui/shared/fileio', () => ({ shareOrDownload: vi.fn(async () => undefined) }));

import SummaryScreen from '../../src/ui/summary/SummaryScreen.svelte';
import { exportExcel } from '../../src/ui/summary/excel';
import { shareOrDownload } from '../../src/ui/shared/fileio';
import { app, flushSaves } from '../../src/store/app.svelte';
import { emptyDataset, openCount } from '../../src/domain/dataset';
import { summaryRows } from '../../src/domain/summary';
import { i18n } from '../../src/i18n/index.svelte';
import type { Dataset, Publication } from '../../src/domain/types';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const pub = (id: string, name: string, language: string, variant = ''): Publication =>
  ({ id, name, language, variant, defaultMode: 'hand', archived: false });
const hand = (units: number) => [{ id: `e${units}`, kind: 'hand' as const, units }];
const item = (publicationId: string, units?: number) =>
  ({ publicationId, entries: units === undefined ? [] : hand(units), zero: false, entered: false });

function dataset(): Dataset {
  const ds = emptyDataset('d1', { firstRunDone: true, lastCounter: 'Ana', locationName: 'Centro' });
  ds.publications = [pub('a', 'Alpha', 'English'), pub('b', 'Beta', 'English'), pub('c', 'Gamma', 'Portuguese')];
  ds.counts = [
    { id: 'old', startedAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-01T11:00:00.000Z', counter: 'Old',
      items: [item('a', 100), item('b', 10), item('c', 5)] },
    { id: 'cur', startedAt: '2026-11-01T10:00:00.000Z', counter: 'Ana',
      items: [item('a', 20), item('b'), item('c', 5)] },
  ];
  return ds;
}

beforeEach(() => {
  i18n.lang = 'en';
  Object.assign(app, { summaryCountId: null, onlyNotCounted: false, tab: 'count', openItemId: null });
  app.ds = dataset();
  vi.mocked(shareOrDownload).mockClear();
  writeXlsxFile.mockClear();
});
afterEach(async () => { cleanup(); await flushSaves(); });

describe('summary screen', () => {
  test('groups by language and shows dash for not counted', () => {
    render(SummaryScreen, { countId: 'cur' });
    expect(screen.getByRole('columnheader', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Portuguese' })).toBeTruthy();
    const beta = screen.getByRole('row', { name: /Beta/ });
    expect(within(beta).getByText('—')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Alpha/ })).getByText('20')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Entered: Alpha' })).toBeTruthy();
  });

  test('big change row has text warning', () => {
    render(SummaryScreen, { countId: 'cur' });
    expect(within(screen.getByRole('row', { name: /Alpha/ })).getByText(/changed a lot, please check/)).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Gamma/ })).queryByText(/changed a lot/)).toBeNull();
  });

  test('not counted warning jumps to the filtered count list', async () => {
    app.summaryCountId = 'cur';
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: /1 not counted/ }));
    expect(app.onlyNotCounted).toBe(true);
    expect(app.tab).toBe('count');
    expect(app.summaryCountId).toBeNull();
  });

  test('finish with not counted asks confirmation, then offers hand over', async () => {
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: 'Finish count' }));
    expect(openCount(app.ds)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Finish anyway' }));
    expect(openCount(app.ds)).toBeUndefined();
    expect(screen.getByText("Hand over to next month's counter?")).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Export file' }));
    expect(shareOrDownload).toHaveBeenCalledOnce();
    const [name, text, mime] = vi.mocked(shareOrDownload).mock.calls[0];
    expect(name).toMatch(/^centro-\d{4}-\d{2}-\d{2}\.pubcount$/);
    expect(JSON.parse(text as string).formatVersion).toBe(1);
    expect(mime).toBe('application/json');
  });

  test('finish with everything counted needs no confirmation', async () => {
    app.ds.counts[1].items[1] = item('b', 3);
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: 'Finish count' }));
    expect(openCount(app.ds)).toBeUndefined();
  });

  test('reopen finished count; finish hidden there', async () => {
    app.ds.counts[1].finishedAt = '2026-11-02T10:00:00.000Z';
    render(SummaryScreen, { countId: 'cur' });
    expect(screen.queryByRole('button', { name: 'Finish count' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen count' }));
    expect(openCount(app.ds)?.id).toBe('cur');
  });

  test('reopen with another count open shows an error message', async () => {
    app.ds.counts[1].finishedAt = '2026-11-02T10:00:00.000Z';
    app.ds.counts.push({ id: 'x', startedAt: '2026-11-05T10:00:00.000Z', counter: 'Z', items: [] });
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: 'Reopen count' }));
    expect(screen.getByRole('alert').textContent).toContain('Another count is already in progress');
  });

  test('entered checkbox works on a finished count', async () => {
    app.ds.counts[1].finishedAt = '2026-11-02T10:00:00.000Z';
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Entered: Alpha' }));
    expect(app.ds.counts[1].items[0].entered).toBe(true);
  });

  test('invalid item shows needs attention and counts as not counted', () => {
    app.ds.counts[1].items[2].entries = [{ id: 'z', kind: 'hand', units: -1 }];
    render(SummaryScreen, { countId: 'cur' });
    expect(within(screen.getByRole('row', { name: /Gamma/ })).getByText('Needs attention')).toBeTruthy();
    expect(screen.getByRole('button', { name: /2 not counted/ })).toBeTruthy();
  });

  test('print button calls window.print', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: 'Print / PDF' }));
    expect(print).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test('excel button exports rows', async () => {
    render(SummaryScreen, { countId: 'cur' });
    await fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await vi.waitFor(() => expect(shareOrDownload).toHaveBeenCalled());
    expect(vi.mocked(shareOrDownload).mock.calls[0][0]).toMatch(/\.xlsx$/);
  });
});

describe('exportExcel', () => {
  test('excel export called with rows', async () => {
    const rows = summaryRows(app.ds, 'cur');
    await exportExcel(rows, { location: 'Centro', date: '2026-11-11', counter: 'Ana' });
    const data = writeXlsxFile.mock.calls[0][0] as { value?: unknown }[][];
    const flat = data.map((r) => r.map((c) => (c && typeof c === 'object' ? c.value : c)));
    expect(flat).toContainEqual(['Publication', 'Language', 'Variant', 'Quantity']);
    expect(flat).toContainEqual(['Alpha', 'English', '', 20]);
    expect(flat).toContainEqual(['Beta', 'English', '', null]);
    expect(shareOrDownload).toHaveBeenCalledWith(
      'centro-2026-11-11.xlsx', expect.any(Blob),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
});
