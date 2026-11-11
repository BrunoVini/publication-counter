import { mount } from 'svelte'
import App from './ui/App.svelte'
import { app, init } from './store/app.svelte'
import { detectLang, i18n } from './i18n/index.svelte'
import { applyTheme } from './ui/theme'

// NOTE: no top-level await; the safari15 build target does not support it.
async function start(): Promise<void> {
  await init()
  i18n.lang = app.ds.settings.language ?? detectLang(navigator.languages ?? [])
  applyTheme(app.ds.settings.theme)
  document.documentElement.lang = i18n.lang
  mount(App, { target: document.getElementById('app')! })
}

void start()
