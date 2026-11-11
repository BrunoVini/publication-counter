<script lang="ts">
  import { fmtDateTime, t } from '../../i18n/index.svelte';
  import { drive, resolveConflict, type Summary } from '../../store/sync.svelte';

  let dlg: HTMLDialogElement;
  const open = $derived(drive.status === 'conflict' && drive.conflict !== null);
  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });

  const changed = (s: Summary) =>
    s.modifiedAt ? fmtDateTime(s.modifiedAt) : t('drive.conflict.unknown');
  const cols = $derived(drive.conflict ? [
    { name: t('drive.conflict.device'), s: drive.conflict.local },
    { name: t('drive.conflict.drive'), s: drive.conflict.remoteSummary },
  ] : []);
</script>

<!-- NOTE: Esc and backdrop clicks are ignored on purpose; onclose reopens it when a second Esc or the Android back button closes it anyway. -->
<dialog bind:this={dlg} aria-labelledby="cf-title" oncancel={(e) => e.preventDefault()}
  onclose={() => { if (open) dlg.showModal(); }}>
  <div class="content">
    <h2 id="cf-title">{t('drive.conflict.title')}</h2>
    <p>{t('drive.conflict.intro')}</p>
    <div class="cols">
      {#each cols as c (c.name)}
        <dl>
          <dt class="name">{c.name}</dt>
          <dt>{t('drive.conflict.changed')}</dt><dd>{changed(c.s)}</dd>
          <dt>{t('drive.conflict.open')}</dt><dd>{c.s.hasOpenCount ? t('drive.conflict.yes') : t('drive.conflict.no')}</dd>
          <dt>{t('drive.conflict.pubs')}</dt><dd>{c.s.publications}</dd>
        </dl>
      {/each}
    </div>
    <div class="acts">
      <button type="button" onclick={() => void resolveConflict('device')}>{t('drive.conflict.useDevice')}</button>
      <button type="button" onclick={() => void resolveConflict('drive')}>{t('drive.conflict.useDrive')}</button>
    </div>
    <p class="muted">{t('drive.conflict.kept')}</p>
  </div>
</dialog>

<style>
  dialog { width: min(460px, calc(100vw - 2 * var(--sp-4))); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
  dl { display: grid; gap: 2px; }
  dt { color: var(--muted); font-size: var(--fs-sm); }
  dt.name { color: var(--text); font-weight: 700; font-size: var(--fs-md); }
  dd { margin: 0 0 var(--sp-2); }
  .acts { display: grid; gap: var(--sp-2); }
</style>
