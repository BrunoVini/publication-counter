import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import App from '../../src/ui/App.svelte';
import { app, flushSaves } from '../../src/store/app.svelte';
import { addPublication, emptyDataset, startCount } from '../../src/domain/dataset';
import { serializeDataset } from '../../src/domain/file';
import { i18n } from '../../src/i18n/index.svelte';
import { handleSharedFile, setupLaunchQueue, setupWakeLock } from '../../src/launch';

const incoming = () => {
  const ds = emptyDataset('incoming');
  addPublication(ds, { name: 'Incoming pub', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p-in');
  return serializeDataset(ds);
};
const nav = navigator as unknown as Record<string, unknown>;
const win = window as unknown as Record<string, unknown>;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  app.ds = emptyDataset('current');
  app.ds.settings.firstRunDone = true;
  app.incomingFile = null;
  i18n.lang = 'en';
});
afterEach(async () => {
  cleanup();
  await flushSaves();
  vi.unstubAllGlobals();
  delete win.launchQueue; delete nav.wakeLock; delete nav.standalone;
  history.replaceState(null, '', '/');
});

describe('shared file', () => {
  const mockCache = (text: string | null) => {
    const del = vi.fn(async () => true);
    const cache = { match: vi.fn(async () => (text === null ? undefined : new Response(text))), delete: del };
    vi.stubGlobal('caches', { open: vi.fn(async () => cache) });
    return del;
  };

  test('shared=1 reads cached file and opens it', async () => {
    const del = mockCache(incoming());
    history.replaceState(null, '', '/?shared=1');
    await handleSharedFile();
    expect(del).toHaveBeenCalled();
    expect(app.ds.publications.map((p) => p.name)).toEqual(['Incoming pub']);
    expect(location.search).toBe('');
  });

  test('with existing data it asks first instead of replacing', async () => {
    addPublication(app.ds, { name: 'Mine', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p-mine');
    mockCache(incoming());
    history.replaceState(null, '', '/?shared=1');
    await handleSharedFile();
    expect(app.ds.publications[0].name).toBe('Mine');
    expect(app.incomingFile).not.toBeNull();
  });

  test('an invalid file changes nothing', async () => {
    mockCache('not json');
    history.replaceState(null, '', '/?shared=1');
    await handleSharedFile();
    expect(app.ds.datasetId).toBe('current');
    expect(app.incomingFile).toBeNull();
  });

  test('confirming the dialog opens the pending file', async () => {
    addPublication(app.ds, { name: 'Mine', language: 'en', variant: '', defaultMode: 'weigh' }, () => 'p-mine');
    app.incomingFile = incoming();
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Replace data' }));
    await waitFor(() => expect(app.ds.publications[0].name).toBe('Incoming pub'));
    expect(app.incomingFile).toBeNull();
  });
});

describe('launchQueue', () => {
  test('launchQueue file is opened', async () => {
    let consumer: (p: unknown) => Promise<void> = async () => undefined;
    win.launchQueue = { setConsumer: (fn: typeof consumer) => { consumer = fn; } };
    setupLaunchQueue();
    await consumer({ files: [{ getFile: async () => ({ text: async () => incoming() }) }] });
    expect(app.ds.publications.map((p) => p.name)).toEqual(['Incoming pub']);
  });
});

describe('wake lock', () => {
  test('is held only while a count is open', async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    nav.wakeLock = { request };
    const stop = setupWakeLock();
    flushSync();
    expect(request).not.toHaveBeenCalled();
    startCount(app.ds, 'me', '2026-01-01T00:00:00Z', () => 'c1');
    flushSync();
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    app.ds.counts[0].finishedAt = '2026-01-01T01:00:00Z';
    flushSync();
    await waitFor(() => expect(release).toHaveBeenCalled());
    stop();
  });
});

describe('ios banner', () => {
  const ios = () => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

  test('ios non-standalone shows install banner', async () => {
    ios();
    render(App);
    expect(screen.getByText(/Add to Home Screen to keep your data/)).toBeTruthy();
    await fireEvent.click(within(screen.getByText(/Add to Home Screen to keep your data/).parentElement!).getByRole('button'));
    expect(screen.queryByText(/Add to Home Screen to keep your data/)).toBeNull();
  });

  test('standalone ios shows no banner', () => {
    ios();
    nav.standalone = true;
    render(App);
    expect(screen.queryByText(/Add to Home Screen to keep your data/)).toBeNull();
  });
});
