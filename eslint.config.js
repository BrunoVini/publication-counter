import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.superpowers/',
      'local_docs/',
      'dev-dist/',
      'coverage/',
      'src/data/*.json',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    extends: [tseslint.configs.recommended],
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['src/**', 'tests/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/sw.ts'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['scripts/**', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },  // NOTE: temporary until these files are split
  {
    files: [
      'src/domain/dataset.ts',
      'src/ui/count/CountScreen.svelte',
      'src/ui/count/ItemPanel.svelte',
      'src/ui/publications/PublicationsScreen.svelte',
      'src/ui/settings/SettingsScreen.svelte',
      'tests/domain/dataset.test.ts',
      'tests/store/sync.test.ts',
      'tests/ui/item-panel.test.ts',
    ],
    rules: { 'max-lines': 'off' },
  },
);
