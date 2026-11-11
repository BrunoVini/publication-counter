<script lang="ts">
  import './theme.css';
  import { app } from '../store/app.svelte';
  import { t } from '../i18n/index.svelte';
  import Toast from './shared/Toast.svelte';
  import Icon from './shared/Icon.svelte';
  import FirstRun from './FirstRun.svelte';
  import CountScreen from './count/CountScreen.svelte';
  import PublicationsScreen from './publications/PublicationsScreen.svelte';
  import SettingsScreen from './settings/SettingsScreen.svelte';
  import SummaryScreen from './summary/SummaryScreen.svelte';
  import ConfirmDialog from './shared/ConfirmDialog.svelte';
  import { isIosBrowser } from './shared/platform';
  import { drive } from '../store/sync.svelte';
  import ConflictDialog from './shared/ConflictDialog.svelte';
  import { applyIncoming } from '../launch';

  // NOTE: dismissing the iOS banner lasts for this page session only.
  let iosBanner = $state(isIosBrowser());
  function confirmIncoming() {
    const text = app.incomingFile;
    app.incomingFile = null;
    if (text !== null) void applyIncoming(text);
  }

  const tabs = ['count', 'publications', 'settings'] as const;
  const icons = { count: 'scale', publications: 'books', settings: 'gear' } as const;
</script>

{#if !app.ds.settings.firstRunDone}
  <FirstRun />
{:else}
  <div class="shell">
    <header class="no-print">
      <strong class="brand"><Icon name="scale" size={22} /> {t('app.name')}</strong>
      <!-- NOTE: while the alert banner is shown it is the only live announcement. -->
      <span class="save" role={app.saveState === 'unavailable' ? undefined : 'status'}>
        {#if app.saveState === 'saving'}<span aria-hidden="true">…</span>{:else}<Icon name={app.saveState === 'saved' ? 'check' : 'warn'} size={16} />{/if}
        {t(`save.${app.saveState}`)}
      </span>
      <span class="save" role="status" aria-live="polite">
        {#if drive.status !== 'off' && drive.status !== 'notConfigured'}{t(`drive.status.${drive.status}`)}{/if}
      </span>
    </header>

    {#if app.saveState === 'unavailable'}
      <div class="banner" role="alert">{t('save.unavailableBanner')}</div>
    {/if}

    {#if iosBanner}
      <div class="banner ios no-print">
        <span>{t('ios.banner')}</span>
        <button type="button" class="icon-btn" aria-label={t('toast.dismiss')} onclick={() => (iosBanner = false)}><Icon name="close" /></button>
      </div>
    {/if}

    <nav aria-label={t('nav.label')}>
      {#each tabs as tab (tab)}
        <button type="button" aria-current={app.tab === tab ? 'page' : undefined} onclick={() => (app.tab = tab)}>
          <Icon name={icons[tab]} size={24} />
          <span>{t(`nav.${tab}`)}</span>
        </button>
      {/each}
    </nav>

    <main>
      <h1>{t(`nav.${app.tab}`)}</h1>
      {#if app.tab === 'count'}
        {#if app.summaryCountId}
          <SummaryScreen countId={app.summaryCountId} />
        {:else}
          <CountScreen />
        {/if}
      {:else if app.tab === 'publications'}
        <PublicationsScreen />
      {:else}
        <SettingsScreen />
      {/if}
    </main>
  </div>
{/if}
<ConfirmDialog open={app.incomingFile !== null} title={t('set.openTitle')} message={t('set.openMessage')}
  confirmLabel={t('set.openConfirm')} danger onconfirm={confirmIncoming} oncancel={() => (app.incomingFile = null)} />
<ConflictDialog />
<Toast />

<style>
  .shell { min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; padding-bottom: var(--nav-h); }
  header { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); padding: 0 var(--sp-4); min-height: 48px; border-bottom: 1px solid var(--border); }
  .brand { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--accent); font-size: 18px; }
  .save { color: var(--muted); font-size: var(--fs-sm); }
  .banner { background: var(--warn-bg); color: var(--warn-text); padding: var(--sp-3) var(--sp-4); font-weight: 600; }
  .ios { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); padding-block: var(--sp-1); }
  .ios button { color: inherit; }
  main { width: 100%; max-width: 1100px; margin: 0 auto; padding: var(--sp-4); }
  h1 { margin-bottom: var(--sp-3); }
  nav { position: fixed; bottom: 0; left: 0; right: 0; height: var(--nav-h); display: flex; background: var(--bg); border-top: 1px solid var(--border); z-index: 10; }
  nav button { flex: 1; flex-direction: column; gap: 2px; padding: 0; background: none; border: 0; border-top: 3px solid transparent; border-radius: 0; color: var(--muted); font-size: 13px; font-weight: 600; }
  /* NOTE: the bar and the heavier weight mark the current tab, so it does not rely on colour alone. */
  nav button[aria-current='page'] { color: var(--accent); border-top-color: var(--accent); font-weight: 700; }
  @media (min-width: 900px) {
    .shell { padding: 0 0 0 200px; }
    nav { top: 48px; right: auto; bottom: 0; width: 200px; height: auto; flex-direction: column; justify-content: flex-start; gap: var(--sp-1); border-top: 0; border-right: 1px solid var(--border); padding: var(--sp-2); }
    nav button { flex: none; flex-direction: row; justify-content: flex-start; gap: var(--sp-3); padding: 0 var(--sp-3); border-top: 0; border-left: 3px solid transparent; border-radius: var(--radius); font-size: var(--fs-md); }
    nav button[aria-current='page'] { border-left-color: var(--accent); background: var(--accent-soft); color: var(--text); }
    header { margin-left: -200px; padding-left: var(--sp-4); }
  }
</style>
