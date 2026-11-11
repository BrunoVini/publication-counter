<script lang="ts">
  import './theme.css';
  import { app } from '../store/app.svelte';
  import { t } from '../i18n/index.svelte';
  import Toast from './shared/Toast.svelte';
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
  const icons = { count: '☰', publications: '▤', settings: '⚙' } as const;
</script>

{#if !app.ds.settings.firstRunDone}
  <FirstRun />
{:else}
  <div class="shell">
    <header class="no-print">
      <strong>{t('app.name')}</strong>
      <!-- NOTE: while the alert banner is shown it is the only live announcement. -->
      <span class="save" role={app.saveState === 'unavailable' ? undefined : 'status'}>
        <span aria-hidden="true">{app.saveState === 'saved' ? '✓' : app.saveState === 'saving' ? '…' : '!'}</span>
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
        <button type="button" aria-label={t('toast.dismiss')} onclick={() => (iosBanner = false)}>×</button>
      </div>
    {/if}

    <nav aria-label={t('nav.label')}>
      {#each tabs as tab (tab)}
        <button type="button" aria-current={app.tab === tab ? 'page' : undefined} onclick={() => (app.tab = tab)}>
          <span aria-hidden="true">{icons[tab]}</span>
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
  .shell { min-height: 100vh; display: grid; grid-template-rows: auto auto 1fr; padding-bottom: 64px; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 0 16px; min-height: 48px; border-bottom: 1px solid var(--border); }
  .save { color: var(--muted); font-size: 14px; }
  .banner { background: var(--warn-bg); color: var(--warn-text); padding: 10px 16px; font-weight: 600; }
  .ios { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .ios button { min-width: 44px; min-height: 44px; background: none; border: 0; color: inherit; font-size: 20px; }
  main { padding: 16px; }
  nav { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: var(--bg); border-top: 1px solid var(--border); z-index: 10; }
  nav button { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 0; background: none; border: 0; color: var(--muted); font-size: 12px; }
  nav button[aria-current='page'] { color: var(--accent); font-weight: 700; }
  @media (min-width: 900px) {
    .shell { padding: 0 0 0 200px; }
    nav { top: 48px; right: auto; bottom: 0; width: 200px; flex-direction: column; justify-content: flex-start; border-top: 0; border-right: 1px solid var(--border); padding: 8px; }
    nav button { flex: none; flex-direction: row; justify-content: flex-start; gap: 12px; padding: 0 12px; font-size: 16px; }
    header { margin-left: -200px; padding-left: 16px; }
  }
</style>
