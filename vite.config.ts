import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  build: { target: ['es2020', 'safari15'] },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
})
