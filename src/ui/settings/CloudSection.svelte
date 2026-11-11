<script lang="ts">
  import { onMount } from 'svelte';
  import { fmtDateTime, t } from '../../i18n/index.svelte';
  import { connect, deleteDriveBackup, disconnect, drive, reconnect, syncNow, warmDrive } from '../../store/sync.svelte';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import Icon from '../shared/Icon.svelte';

  let confirming = $state(false);
  let deleting = $state(false);
  let busy = $state(false);
  // NOTE: the flag is set synchronously and the call follows with no await, so the popup keeps the click gesture.
  function run(fn: () => Promise<void>) { busy = true; fn().finally(() => (busy = false)); }
  const connected = $derived(drive.status === 'idle' || drive.status === 'syncing');

  // NOTE: preloads the sign-in script so the Connect click can open the popup inside the user gesture.
  onMount(() => { void warmDrive(); });
  function confirmDelete() { deleting = false; void deleteDriveBackup(); }
  function confirmDisconnect() { confirming = false; void disconnect(); }
</script>

{#snippet disconnectBtn()}
  <button type="button" onclick={() => (confirming = true)}>{t('drive.disconnect')}</button>
{/snippet}

{#snippet deleteBtn(disabled: boolean)}
  <button type="button" class="danger" {disabled} onclick={() => (deleting = true)}><Icon name="trash" /> {t('drive.delete')}</button>
  {#if disabled}<p class="muted">{t('drive.deleteExpiredHint')}</p>{/if}
{/snippet}

<div class="stack">
  {#if drive.status === 'notConfigured'}
    <p class="muted">{t('drive.notConfigured')}</p>
  {:else if drive.status === 'off' || drive.status === 'conflict'}
    {#if drive.status === 'off'}
      <button type="button" disabled={busy} onclick={() => run(connect)}><Icon name="cloud" /> {t('drive.connect')}</button>
      <p class="muted">{t('drive.visibility')}</p>
      {#if drive.error}<p class="bad" role="alert">{drive.error}</p>{/if}
    {:else}
      <p>{t('drive.status.conflict')}</p>
    {/if}
  {:else if drive.status === 'expired'}
    <p>{t('drive.expired')}</p>
    <button type="button" disabled={busy} onclick={() => run(reconnect)}><Icon name="cloud" /> {t('drive.reconnect')}</button>
    {@render disconnectBtn()}
    {@render deleteBtn(true)}
  {:else if drive.status === 'error'}
    {#if drive.error}<p class="bad" role="alert">{drive.error}</p>{/if}
    <div class="btn-row">
      <button type="button" onclick={() => void syncNow()}>{t('drive.retry')}</button>
      {@render disconnectBtn()}
    </div>
  {/if}

  {#if connected}
    <p class="state"><Icon name={drive.status === 'idle' ? 'check' : 'cloud'} /> {t('drive.status.' + drive.status)}</p>
    <p class="muted">{drive.lastSyncAt ? t('drive.lastBackup', { when: fmtDateTime(drive.lastSyncAt) }) : t('drive.never')}</p>
    <div class="btn-row">
      <button type="button" disabled={drive.status === 'syncing'} onclick={() => void syncNow()}>{t('drive.syncNow')}</button>
      {@render disconnectBtn()}
    </div>
    {@render deleteBtn(false)}
  {/if}
</div>

<ConfirmDialog open={confirming} title={t('drive.disconnectTitle')} message={t('drive.disconnectMessage')}
  confirmLabel={t('drive.disconnect')} onconfirm={confirmDisconnect} oncancel={() => (confirming = false)} />

<ConfirmDialog open={deleting} title={t('drive.deleteTitle')} message={t('drive.deleteMessage')}
  confirmLabel={t('drive.delete')} danger onconfirm={confirmDelete} oncancel={() => (deleting = false)} />

<style>
  .stack > button { justify-self: start; }
  .state { color: var(--accent); font-weight: 600; }
</style>
