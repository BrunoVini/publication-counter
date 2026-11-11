import { mount } from 'svelte'
import App from './ui/App.svelte'
import { app, init } from './store/app.svelte'
import { detectLang, setLang } from './i18n/index.svelte'
import { applyTheme } from './ui/theme'
import { handleSharedFile, setupLaunchQueue, setupWakeLock } from './launch'
import { initDrive, syncNow } from './store/sync.svelte'
import { showToast } from './ui/shared/Toast.svelte'
import { t } from './i18n/index.svelte'

// NOTE: no top-level await; the safari15 build target does not support it.
async function start(): Promise<void> {
  await init()
  // NOTE: the locale chunk is awaited before mounting so the first paint never shows keys.
  await setLang(app.ds.settings.language ?? detectLang(navigator.languages ?? []))
  applyTheme(app.ds.settings.theme)
  mount(App, { target: document.getElementById('app')! })
  setupLaunchQueue()
  setupWakeLock()
  void handleSharedFile()
  void initDrive()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void syncNow() })
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
