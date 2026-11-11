import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// NOTE: colours mirror --bg / --accent in src/ui/theme.css.
export default defineConfig({
  plugins: [
    svelte(),
    svelteTesting(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'PubCount',
        short_name: 'PubCount',
        description: 'Count publications by weight, offline.',
        lang: 'en',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#2b7a4b',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        file_handlers: [{ action: '/', accept: { 'application/x-pubcount+json': ['.pubcount'] } }],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { files: [{ name: 'file', accept: ['.pubcount', 'application/json', 'application/x-pubcount+json'] }] },
        },
      } as never,
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,webmanifest}'] },
    }),
  ],
  build: { target: ['es2020', 'safari15'] },
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'] },
})
