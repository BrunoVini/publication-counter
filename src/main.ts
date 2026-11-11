import { mount } from 'svelte'
import App from './ui/App.svelte'
import { app, init } from './store/app.svelte'
import { detectLang, i18n } from './i18n/index.svelte'
import { applyTheme } from './ui/theme'
import { handleSharedFile, setupLaunchQueue, setupWakeLock } from './launch'
import { showToast } from './ui/shared/Toast.svelte'
import { t } from './i18n/index.svelte'

// NOTE: no top-level await; the safari15 build target does not support it.
async function start(): Promise<void> {
  await init()
  i18n.lang = app.ds.settings.language ?? detectLang(navigator.languages ?? [])
  applyTheme(app.ds.settings.theme)
  document.documentElement.lang = i18n.lang
  mount(App, { target: document.getElementById('app')! })
  setupLaunchQueue()
  setupWakeLock()
  void handleSharedFile()
  // NOTE: dynamic import keeps the virtual module out of tests; the update toast stays until dismissed.
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh: () => showToast(t('pwa.update'), { label: t('pwa.reload'), run: () => void updateSW(true) }),
    })
  })
}

start().catch(() => {
  // NOTE: i18n may not be loaded here, so the message is static (en + pt).
  const el = document.getElementById('app')
  if (el) el.textContent = 'PubCount could not start. Reload the page. / O PubCount não conseguiu iniciar. Recarregue a página.'
})
