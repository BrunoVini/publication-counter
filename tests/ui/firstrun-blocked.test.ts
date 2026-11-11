import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import App from '../../src/ui/App.svelte';
import { app } from '../../src/store/app.svelte';
import { emptyDataset } from '../../src/domain/dataset';
import { i18n } from '../../src/i18n/index.svelte';

// The list never loads, so no primary language can be preselected or chosen.
vi.mock('../../src/data/languages.json', () => new Promise(() => {}));

beforeEach(() => { app.ds = emptyDataset('first'); i18n.lang = 'en'; });
afterEach(() => { cleanup(); app.tab = 'count'; });

test('first run cannot continue without a primary language', async () => {
  render(App);
  const next = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
  expect(next.disabled).toBe(true);
  await fireEvent.click(next);
  expect(app.ds.settings.pubLanguage).toBeUndefined();
  expect(screen.queryByRole('heading', { name: 'How do you want to start?' })).toBeNull();
});
