import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ConfirmDialog from '../../src/ui/shared/ConfirmDialog.svelte';
import { i18n } from '../../src/i18n/index.svelte';
import { t } from '../../src/i18n/index.svelte';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

describe('typed confirmation', () => {
  test.each([['pt', 'APAGAR'], ['en', 'DELETE'], ['es', 'BORRAR']] as const)('%s needs %s', async (lang, word) => {
    i18n.lang = lang;
    expect(t('set.wipeWord')).toBe(word);
    const onconfirm = vi.fn();
    render(ConfirmDialog, { open: true, title: 'x', message: 'y', confirmLabel: 'Go', requireText: t('set.wipeWord'), onconfirm, oncancel() {} });
    const go = screen.getByRole<HTMLButtonElement>('button', { name: 'Go' });
    const input = screen.getByRole('textbox');
    expect(go.disabled).toBe(true);
    await fireEvent.input(input, { target: { value: word.slice(0, -1) } });
    expect(go.disabled).toBe(true);
    await fireEvent.input(input, { target: { value: `  ${word.toLowerCase()} ` } });
    expect(go.disabled).toBe(false);
    await fireEvent.click(go);
    expect(onconfirm).toHaveBeenCalledTimes(1);
  });

  test('without requireText there is no input and the button is enabled', () => {
    render(ConfirmDialog, { open: true, title: 'x', message: 'y', confirmLabel: 'Go', onconfirm() {}, oncancel() {} });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Go' })).disabled).toBe(false);
  });
});
