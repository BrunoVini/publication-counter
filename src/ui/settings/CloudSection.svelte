<script lang="ts">
  import { onMount } from 'svelte';
  import { fmtDate, i18n, t } from '../../i18n/index.svelte';
  import { connect, disconnect, drive, reconnect, syncNow, warmDrive } from '../../store/sync.svelte';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';

  let confirming = $state(false);
  const connected = $derived(drive.status === 'idle' || drive.status === 'syncing');
  const when = (iso: string) => `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })}`;

  // NOTE: preloads the sign-in script so the Connect click can open the popup inside the user gesture.
  onMount(() => { void warmDrive(); });
  function confirmDisconnect() { confirming = false; void disconnect(); }
</script>

<div class="stack">
  {#if drive.status === 'notConfigured'}
    <p class="muted">{t('drive.notConfigured')}</p>
  {:else if drive.status === 'off' || drive.status === 'conflict'}
    {#if drive.status === 'off'}
      <button type="button" onclick={() => void connect()}>{t('drive.connect')}</button>
      <p class="muted">{t('drive.visibility')}</p>
      {#if drive.error}<p class="bad" role="alert">{drive.error}</p>{/if}
    {:else}
      <p>{t('drive.status.conflict')}</p>
    {/if}
  {:else if drive.status === 'expired'}
    <p>{t('drive.expired')}</p>
    <button type="button" onclick={() => void reconnect()}>{t('drive.reconnect')}</button>
  {:else if drive.status === 'error'}
    <p class="bad" role="alert">{drive.error}</p>
    <button type="button" onclick={() => void syncNow()}>{t('drive.retry')}</button>
  {/if}

  {#if connected}
    <p>{t('drive.status.' + drive.status)}</p>
    <p class="muted">{drive.lastSyncAt ? t('drive.lastBackup', { when: when(drive.lastSyncAt) }) : t('drive.never')}</p>
    <div class="row">
      <button type="button" disabled={drive.status === 'syncing'} onclick={() => void syncNow()}>{t('drive.syncNow')}</button>
      <button type="button" onclick={() => (confirming = true)}>{t('drive.disconnect')}</button>
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
