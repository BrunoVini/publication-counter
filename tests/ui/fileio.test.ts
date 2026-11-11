import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { serializeDataset } from '../../src/domain/file';
import { emptyDataset } from '../../src/domain/dataset';

vi.mock('../../src/store/app.svelte', () => ({ replaceDataset: vi.fn(async () => undefined) }));
import { replaceDataset } from '../../src/store/app.svelte';
import { openPubcountText, pickTextFile, shareOrDownload } from '../../src/ui/shared/fileio';

const nav = navigator as unknown as Record<string, unknown>;
let clickSpy: ReturnType<typeof vi.spyOn>;
let create: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;

beforeEach(() => {
  create = vi.fn(() => 'blob:x');
  revoke = vi.fn();
  URL.createObjectURL = create as never;
  URL.revokeObjectURL = revoke as never;
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.mocked(replaceDataset).mockClear();
});
afterEach(() => {
  delete nav.share; delete nav.canShare;
  vi.restoreAllMocks(); vi.useRealTimers();
});

describe('shareOrDownload', () => {
  test('uses the share sheet when files can be shared', async () => {
    nav.canShare = () => true; nav.share = vi.fn(async () => undefined);
    await shareOrDownload('a.pubcount', 'x', 'application/x-pubcount+json');
    expect(nav.share).toHaveBeenCalledOnce();
    expect(clickSpy).not.toHaveBeenCalled();
  });
  test('AbortError neither downloads nor throws', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn(async () => { throw new DOMException('x', 'AbortError'); });
    await expect(shareOrDownload('a', 'x', 'text/plain')).resolves.toBeUndefined();
    expect(clickSpy).not.toHaveBeenCalled();
  });
  test('other share errors fall back to download', async () => {
    nav.canShare = () => true;
    nav.share = vi.fn(async () => { throw new Error('boom'); });
    vi.useFakeTimers();
    await shareOrDownload('a', 'x', 'text/plain');
    vi.runAllTimers();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
  test('without canShare it downloads and revokes the URL', async () => {
    vi.useFakeTimers();
    await shareOrDownload('a', 'x', 'text/plain');
    vi.runAllTimers();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a')).toBeNull();
  });
});

describe('pickTextFile', () => {
  const start = () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const p = pickTextFile('.pubcount');
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    return { p, input };
  };
  test('resolves the file text on change and removes the input', async () => {
    const { p, input } = start();
    Object.defineProperty(input, 'files', { value: [{ text: async () => 'hello' }] });
    input.dispatchEvent(new Event('change'));
    expect(await p).toBe('hello');
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  test('resolves null on the cancel event', async () => {
    const { p, input } = start();
    input.dispatchEvent(new Event('cancel'));
    expect(await p).toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  test('resolves null on window focus with no file', async () => {
    vi.useFakeTimers();
    const { p } = start();
    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(600);
    expect(await p).toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
});

describe('openPubcountText', () => {
  test.each([
    ['not json', 'notJson'],
    ['{"nope":1}', 'invalid'],
    [JSON.stringify({ formatVersion: 2 }), 'tooNew'],
  ])('%s -> %s without replacing', async (text, code) => {
    expect(await openPubcountText(text)).toBe(code);
    expect(replaceDataset).not.toHaveBeenCalled();
  });
  test('valid text replaces the data', async () => {
    expect(await openPubcountText(serializeDataset(emptyDataset('z')))).toBe('ok');
    expect(replaceDataset).toHaveBeenCalledOnce();
  });
});
