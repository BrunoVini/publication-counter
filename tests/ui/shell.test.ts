import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
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
    expect(screen.getByRole('status', { name: /save/i }).textContent).toMatch(/not saved/i);
  });

  test('no banner while saved', () => {
    render(App);
    expect(screen.queryByRole('alert')).toBeNull();
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
});
