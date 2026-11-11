import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import App from '../../src/ui/App.svelte';
import ConfirmDialog from '../../src/ui/shared/ConfirmDialog.svelte';
import { showToast } from '../../src/ui/shared/Toast.svelte';
import { applyTheme } from '../../src/ui/theme';
import { app } from '../../src/store/app.svelte';
import { i18n } from '../../src/i18n/index.svelte';

beforeAll(() => {
  // jsdom has no modal dialog support.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => { app.ds.settings.firstRunDone = true; });
afterEach(() => { cleanup(); app.saveState = 'saved'; app.tab = 'count'; i18n.lang = 'en'; });

describe('shell', () => {
  test('renders three nav destinations with labels', () => {
    i18n.lang = 'en';
    render(App);
    const nav = screen.getByRole('navigation');
    const items = nav.querySelectorAll('button span:not([aria-hidden])');
    expect([...items].map((b) => b.textContent?.trim())).toEqual(['Count', 'Publications', 'Settings']);
  });

  test('tab buttons switch the region and mark the current one', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(app.tab).toBe('settings');
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
  });

  test('shows not-saved banner when saveState is unavailable', () => {
    app.saveState = 'unavailable';
    render(App);
    expect(screen.getByRole('alert').textContent).toMatch(/not being saved/i);
    expect(screen.getByText(/not saved/i)).toBeTruthy();
    // NOTE: only the banner announces while it is shown.
    expect(screen.queryByRole('status')).toBeNull();
  });

  test('no banner while saved; status text is its own name', () => {
    render(App);
    expect(screen.queryByRole('alert')).toBeNull();
    const st = screen.getByRole('status');
    expect(st.hasAttribute('aria-label')).toBe(false);
    expect(st.textContent).toMatch(/saved/i);
  });

  test('toast is announced politely and replaced by the next one', async () => {
    render(App);
    const fn = vi.fn();
    showToast('First');
    showToast('Second', { label: 'Undo', run: fn });
    flushSync();
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second').closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(fn).toHaveBeenCalledOnce();
  });
});

test('dismissing the toast removes it', async () => {
  render(App);
  showToast('Bye');
  flushSync();
  expect(screen.getByText('Bye')).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
  expect(screen.queryByText('Bye')).toBeNull();
});

describe('applyTheme', () => {
  test('sets and removes data-theme', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('ConfirmDialog', () => {
  test('calls onconfirm only on confirm', async () => {
    const onconfirm = vi.fn(), oncancel = vi.fn();
    render(ConfirmDialog, { open: true, title: 'Delete?', message: 'Sure?', confirmLabel: 'Delete', onconfirm, oncancel });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onconfirm).not.toHaveBeenCalled();
    expect(oncancel).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onconfirm).toHaveBeenCalledOnce();
  });

  describe('dismissal', () => {
    const mk = () => {
      const oncancel = vi.fn();
      const { container } = render(ConfirmDialog, { open: true, title: 'T', message: 'Msg', confirmLabel: 'OK', onconfirm: vi.fn(), oncancel });
      return { oncancel, dlg: container.querySelector('dialog')! };
    };
    test('Esc (cancel event) calls oncancel', async () => {
      const { oncancel, dlg } = mk();
      const ev = new Event('cancel', { cancelable: true });
      dlg.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
      expect(oncancel).toHaveBeenCalledOnce();
    });
    test('backdrop click cancels, click inside does not', async () => {
      const { oncancel, dlg } = mk();
      await fireEvent.click(screen.getByText('Msg'));
      expect(oncancel).not.toHaveBeenCalled();
      await fireEvent.click(dlg);
      expect(oncancel).toHaveBeenCalledOnce();
    });
  });
});
