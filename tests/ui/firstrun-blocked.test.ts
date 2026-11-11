import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import App from '../../src/ui/App.svelte';
import { app } from '../../src/store/app.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';

// The list never loads: the primary code is still preselected, only its label would be missing.
vi.mock('../../src/data/languages.json', () => new Promise(() => {}));

beforeEach(() => { app.ds = emptyDataset('first'); i18n.lang = 'en'; });
afterEach(() => { cleanup(); app.tab = 'count'; });

test('first run preselects the primary code without waiting for the languages list', async () => {
  render(App);
  const next = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
  expect(next.disabled).toBe(false);
  await fireEvent.click(next);
  expect(app.ds.settings.pubLanguage).toBe('E');
});
