<script lang="ts">
  import { onMount } from 'svelte';
  import { fmtDateTime, t } from '../../i18n/index.svelte';
  import { connect, disconnect, drive, reconnect, syncNow, warmDrive } from '../../store/sync.svelte';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';

  let confirming = $state(false);
  let busy = $state(false);
  // NOTE: the flag is set synchronously and the call follows with no await, so the popup keeps the click gesture.
  function run(fn: () => Promise<void>) { busy = true; fn().finally(() => (busy = false)); }
  const connected = $derived(drive.status === 'idle' || drive.status === 'syncing');

  // NOTE: preloads the sign-in script so the Connect click can open the popup inside the user gesture.
  onMount(() => { void warmDrive(); });
  function confirmDisconnect() { confirming = false; void disconnect(); }
</script>

{#snippet disconnectBtn()}
  <button type="button" onclick={() => (confirming = true)}>{t('drive.disconnect')}</button>
{/snippet}

<div class="stack">
  {#if drive.status === 'notConfigured'}
    <p class="muted">{t('drive.notConfigured')}</p>
  {:else if drive.status === 'off' || drive.status === 'conflict'}
    {#if drive.status === 'off'}
      <button type="button" disabled={busy} onclick={() => run(connect)}>{t('drive.connect')}</button>
      <p class="muted">{t('drive.visibility')}</p>
      {#if drive.error}<p class="bad" role="alert">{drive.error}</p>{/if}
    {:else}
      <p>{t('drive.status.conflict')}</p>
    {/if}
  {:else if drive.status === 'expired'}
    <p>{t('drive.expired')}</p>
    <button type="button" disabled={busy} onclick={() => run(reconnect)}>{t('drive.reconnect')}</button>
    {@render disconnectBtn()}
  {:else if drive.status === 'error'}
    {#if drive.error}<p class="bad" role="alert">{drive.error}</p>{/if}
    <div class="row">
      <button type="button" onclick={() => void syncNow()}>{t('drive.retry')}</button>
      {@render disconnectBtn()}
    </div>
  {/if}

  {#if connected}
    <p>{t('drive.status.' + drive.status)}</p>
    <p class="muted">{drive.lastSyncAt ? t('drive.lastBackup', { when: fmtDateTime(drive.lastSyncAt) }) : t('drive.never')}</p>
    <div class="row">
      <button type="button" disabled={drive.status === 'syncing'} onclick={() => void syncNow()}>{t('drive.syncNow')}</button>
      {@render disconnectBtn()}
    </div>
  {/if}
</div>

<ConfirmDialog open={confirming} title={t('drive.disconnectTitle')} message={t('drive.disconnectMessage')}
  confirmLabel={t('drive.disconnect')} onconfirm={confirmDisconnect} oncancel={() => (confirming = false)} />

<style>
  .stack { display: grid; gap: 8px; }
  p { margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 16px; justify-self: start; }
  button:disabled { color: var(--muted); }
  .muted { color: var(--muted); }
  .bad { color: var(--bad); }
</style>
