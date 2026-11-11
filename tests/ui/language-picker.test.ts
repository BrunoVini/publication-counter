import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import LanguagePicker from '../../src/ui/shared/LanguagePicker.svelte';
import { loadLanguages } from '../../src/domain/languages.svelte';
import { i18n } from '../../src/i18n/index.svelte';

beforeAll(async () => { await loadLanguages(); i18n.lang = 'pt'; });
afterEach(cleanup);

describe('language picker', () => {
  test('search is accent-insensitive and finds by vernacular name', async () => {
    render(LanguagePicker, { mode: 'single', legend: 'Idioma', value: '', onchange: () => {} });
    const box = screen.getByRole('searchbox', { name: 'Buscar idiomas' });
    await fireEvent.input(box, { target: { value: 'INGLES' } });
    expect(screen.getByRole('radio', { name: /^Inglês(·|$)/ })).toBeTruthy();
    await fireEvent.input(box, { target: { value: 'deutsch' } });
    expect(screen.getByRole('radio', { name: /^Alemão(·|$)/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /^Inglês(·|$)/ })).toBeNull();
  });

  test('single mode reports the chosen code', async () => {
    const onchange = vi.fn();
    render(LanguagePicker, { mode: 'single', legend: 'Idioma', value: '', onchange });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'espanhol' } });
    await fireEvent.click(screen.getByRole('radio', { name: /^Espanhol(·|$)/ }));
    expect(onchange).toHaveBeenCalledWith('S');
  });

  test('multi mode adds and removes codes and keeps selected ones listed', async () => {
    const onchange = vi.fn();
    render(LanguagePicker, { mode: 'multi', legend: 'Outros', value: ['E'], onchange });
    expect((screen.getByRole('checkbox', { name: /^Inglês(·|$)/ }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'frances' } });
    await fireEvent.click(await waitFor(() => screen.getByRole('checkbox', { name: /^Francês(·|$)/ })));
    expect(onchange).toHaveBeenLastCalledWith(['E', 'F']);
    await fireEvent.click(screen.getByRole('checkbox', { name: /^Inglês(·|$)/ }));
    expect(onchange).toHaveBeenLastCalledWith([]);
  });
});
