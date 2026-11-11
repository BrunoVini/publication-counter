<script lang="ts">
  import { fmtDate, i18n, t } from '../../i18n/index.svelte';
  import { drive, resolveConflict, type Summary } from '../../store/sync.svelte';

  let dlg: HTMLDialogElement;
  const open = $derived(drive.status === 'conflict' && drive.conflict !== null);
  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });

  const changed = (s: Summary) =>
    s.modifiedAt ? `${fmtDate(s.modifiedAt)} ${new Date(s.modifiedAt).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })}` : t('drive.conflict.unknown');
  const cols = $derived(drive.conflict ? [
    { name: t('drive.conflict.device'), s: drive.conflict.local },
    { name: t('drive.conflict.drive'), s: drive.conflict.remoteSummary },
  ] : []);
</script>

<!-- NOTE: Esc and backdrop clicks are ignored on purpose; the user must pick a version. -->
<dialog bind:this={dlg} aria-labelledby="cf-title" oncancel={(e) => e.preventDefault()}>
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
    <div class="actions">
      <button type="button" onclick={() => void resolveConflict('device')}>{t('drive.conflict.useDevice')}</button>
      <button type="button" onclick={() => void resolveConflict('drive')}>{t('drive.conflict.useDrive')}</button>
    </div>
    <p class="muted">{t('drive.conflict.kept')}</p>
  </div>
</dialog>

<style>
  dialog { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; max-width: 460px; padding: 0; }
  .content { padding: 16px; display: grid; gap: 12px; }
  h2, p, dl { margin: 0; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  dl { display: grid; gap: 2px; }
  dt { color: var(--muted); font-size: 14px; }
  dt.name { color: var(--text); font-weight: 700; font-size: 16px; }
  dd { margin: 0 0 6px; }
  .actions { display: grid; gap: 8px; }
  button { min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 16px; }
  .muted { color: var(--muted); }
</style>
