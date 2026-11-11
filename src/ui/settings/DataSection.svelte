<script lang="ts">
  import { onMount } from 'svelte';
  import { app, replaceDataset, wipeDevice } from '../../store/app.svelte';
  import { getCorrupt, listBackups, type Backup } from '../../store/persist';
  import { fmtDate, i18n, t } from '../../i18n/index.svelte';
  import { exportFileName, parseDataset, serializeDataset } from '../../domain/file';
  import { localDate } from '../../domain/text';
  import type { Dataset } from '../../domain/types';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { openPubcountText, pickTextFile, shareOrDownload } from '../shared/fileio';
  import Icon from '../shared/Icon.svelte';

  let confirm = $state<'open' | 'wipe' | 'wipeType' | null>(null);
  let restoring = $state<Backup | null>(null);
  let pendingText = '';
  let error = $state('');
  let backups = $state<Backup[]>([]);
  let corrupt = $state<unknown>(undefined);

  const when = (iso: string) => `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })}`;
  const reason = (r: string) => { const k = `set.reason.${r}`; const m = t(k); return m === k ? r : m; };
  const refresh = async () => { backups = await listBackups(); corrupt = await getCorrupt(); };
  onMount(refresh);

  async function handover() {
    try {
      await shareOrDownload(exportFileName(app.ds, localDate()), serializeDataset($state.snapshot(app.ds) as Dataset), 'application/json');
    } catch { showToast(t('set.handoverErr')); }
  }
  async function exportCorrupt() {
    try {
      await shareOrDownload(`pubcount-unreadable-${localDate()}.json`, JSON.stringify(corrupt, null, 2), 'application/json');
    } catch { showToast(t('set.handoverErr')); }
  }
  async function replaceWith(run: () => Promise<string>) {
    error = '';
    try {
      const r = await run();
      if (r === 'ok') showToast(t('set.openDone'));
      else error = t(`set.err.${r}`);
    } catch (e) {
      error = t(e === 'backupFailed' ? 'set.err.backupFailed' : 'set.err.invalid');
    }
    await refresh();
  }
  async function openFile() {
    error = '';
    const text = await pickTextFile('.pubcount,application/json');
    if (text === null) return;
    // NOTE: parse first so an unusable file shows its error instead of a pointless confirmation.
    const parsed = parseDataset(text);
    if (!parsed.ok) { error = t(`set.err.${parsed.error}`); return; }
    if (app.ds.publications.length > 0) { pendingText = text; confirm = 'open'; } else await replaceWith(() => openPubcountText(text));
  }
  function confirmOpen() { confirm = null; return replaceWith(() => openPubcountText(pendingText)); }
  async function confirmWipe() {
    confirm = null;
    error = '';
    try { await wipeDevice(); } catch { error = t('set.wipeErr'); }
  }
  async function restore() {
    const b = restoring;
    restoring = null;
    if (!b) return;
    error = '';
    try {
      await replaceDataset(b.dataset, 'restore backup');
      showToast(t('set.restoreDone'));
    } catch (e) {
      error = t(e === 'backupFailed' ? 'set.err.backupFailed' : 'set.err.invalid');
    }
    await refresh();
  }

</script>

<section class="card stack">
  <h2 class="sec">{t('set.data')}</h2>
  <div class="btn-row">
    <button type="button" onclick={handover}><Icon name="share" /> {t('set.handover')}</button>
    <button type="button" onclick={openFile}><Icon name="folder" /> {t('set.open')}</button>
  </div>
  {#if corrupt !== undefined}
    <button type="button" onclick={exportCorrupt}>{t('set.exportCorrupt')}</button>
  {/if}
  {#if error}<p class="bad" role="alert">{error}</p>{/if}
  <h3>{t('set.restore')}</h3>
  {#if backups.length === 0}
    <p class="muted">{t('set.noBackups')}</p>
  {:else}
    <ul class="backups">
      {#each backups as b (b.savedAt)}
        <li>
          <span>{t('set.backupInfo', { when: when(b.savedAt), reason: reason(b.reason), count: b.dataset.publications.length })}</span>
          <button type="button" onclick={() => (restoring = b)}><Icon name="undo" /> {t('set.restoreBtn')}</button>
        </li>
      {/each}
    </ul>
  {/if}
  <h3>{t('set.wipe')}</h3>
  <button type="button" class="danger" onclick={() => (confirm = 'wipe')}><Icon name="trash" /> {t('set.wipe')}</button>
</section>

<ConfirmDialog open={confirm === 'open'} title={t('set.openTitle')} message={t('set.openMessage')}
  confirmLabel={t('set.openConfirm')} danger onconfirm={confirmOpen} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'wipe'} title={t('set.wipeTitle')} message={t('set.wipeMessage')}
  confirmLabel={t('set.wipeNext')} danger onconfirm={() => (confirm = 'wipeType')} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'wipeType'} title={t('set.wipeTitle2')} message={t('set.wipeMessage2')}
  confirmLabel={t('set.wipeConfirm')} requireText={t('set.wipeWord')} danger onconfirm={confirmWipe} oncancel={() => (confirm = null)} />
<ConfirmDialog open={restoring !== null} title={t('set.restoreTitle')} message={t('set.restoreMessage')}
  confirmLabel={t('set.restoreConfirm')} danger onconfirm={restore} oncancel={() => (restoring = null)} />

<style>
  .card > button { justify-self: start; }
  .btn-row > * { flex: 1 1 auto; }
  .backups { list-style: none; padding: 0; display: grid; gap: var(--sp-2); }
  .backups li { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); }
</style>
