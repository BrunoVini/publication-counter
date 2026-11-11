import { LANGS } from '../src/domain/types';
import { loadLocale } from '../src/i18n/index.svelte';

// NOTE: tests set `i18n.lang` directly, so every locale is loaded up front (the app lazy-loads them).
await Promise.all(LANGS.map(loadLocale));
