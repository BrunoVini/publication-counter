import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  build: { target: ['es2020', 'safari15'] },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
})
