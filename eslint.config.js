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
    files: ['**/*.svelte'],
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
    // NOTE: the svelte preset assigns its parser to *.svelte.ts too; those are plain TypeScript modules.
    files: ['**/*.svelte.ts'],
    languageOptions: { parser: tseslint.parser },
  },
  {
    files: ['**/*.ts', '**/*.svelte'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // NOTE: Date/Map/Set here are transient locals, never reactive state; the Svelte variants add nothing.
      'svelte/prefer-svelte-reactivity': 'off',
      // NOTE: $props() destructuring mixes $bindable() (needs let) with plain props; only flag it when every name could be const.
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // NOTE: the app signals failures with string codes (compared by value in the catch sites); wrapping them in Error would change behaviour.
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
  {
    files: ['src/main.ts', 'src/launch.ts'],
    rules: {
      // NOTE: typed linting cannot see the named export of Toast.svelte's module script (svelte-check does), so showToast resolves to an error type.
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['tests/**'],
    rules: {
      // NOTE: tests stub fetch/DOM/mocks with loosely typed values and async stubs that never await; typing them adds noise, not safety.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
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
  },
);
