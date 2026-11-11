import type { Theme } from '../domain/types';

/** Explicit themes set data-theme; 'system' removes it so prefers-color-scheme decides. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}
