<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { fmtDate, fmtNumber, t } from '../../i18n/index.svelte';
  import { finishCount, reopenCount, setEntered } from '../../domain/dataset';
  import { localDate } from '../../domain/text';
  import { summaryRows } from '../../domain/summary';
  import { exportFileName, serializeDataset } from '../../domain/file';
  import { syncNow } from '../../store/sync.svelte';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { shareOrDownload } from '../shared/fileio';
  import { exportExcel } from './excel';

  let { countId }: { countId: string } = $props();

  const count = $derived(app.ds.counts.find((c) => c.id === countId));
  const rows = $derived(count ? summaryRows(app.ds, countId) : []);
  const groups = $derived(
    rows.reduce<{ language: string; rows: typeof rows }[]>((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && last.language === r.language) last.rows.push(r);
      else acc.push({ language: r.language, rows: [r] });
      return acc;
    }, []),
  );
  const notCounted = $derived(rows.filter((r) => r.units === null).length);
  const finished = $derived(!!count?.finishedAt);

  let confirmFinish = $state(false);
  let handover = $state(false);
  let error = $state('');

  const fail = (e: unknown) => {
    const code = (e as Error)?.message;
    error = code === 'countAlreadyOpen' ? t('summary.err.countAlreadyOpen') : t('summary.err.generic');
  };

  function finish() {
    confirmFinish = false;
    error = '';
    try {
      act((ds) => finishCount(ds, countId, new Date().toISOString()));
      handover = true;
      // NOTE: fire-and-forget; status and errors surface through the drive state.
      syncNow().catch(() => {});
    } catch (e) { fail(e); }
  }
  function reopen() {
    error = '';
    try { act((ds) => reopenCount(ds, countId)); } catch (e) { fail(e); }
  }
  async function exportFile() {
    handover = false;
    try {
      await shareOrDownload(exportFileName(app.ds, localDate()), serializeDataset($state.snapshot(app.ds)), 'application/json');
    } catch { showToast(t('summary.err.generic')); }
  }
  async function excel() {
    if (!count) return;
    try {
      await exportExcel(rows, { location: app.ds.settings.locationName, date: localDate(new Date(count.startedAt)), counter: count.counter });
    } catch { showToast(t('summary.err.excel')); }
  }
  function showNotCounted() {
    app.onlyNotCounted = true;
    app.tab = 'count';
    app.summaryCountId = null;
  }
</script>

{#if count}
  <section>
    <div class="no-print bar">
      <button type="button" onclick={() => (app.summaryCountId = null)}>{t('item.close')}</button>
    </div>
    <h2>{t('summary.title')}</h2>
    <p class="print-only">
      {[app.ds.settings.locationName, fmtDate(count.startedAt)].filter(Boolean).join(' · ')}
      · {t('summary.printMeta', { counter: count.counter })}
    </p>
    <p class="muted no-print">
      {fmtDate(count.startedAt)} · {count.counter} · {finished ? t('summary.finished') : t('summary.open')}
    </p>

    {#if notCounted > 0}
      <button type="button" class="warn no-print" onclick={showNotCounted} title={t('summary.notCountedHint')}>
        <span aria-hidden="true">⚠️</span> {t('summary.notCounted', { count: notCounted })}
      </button>
    {/if}
    {#if error}<p role="alert" class="err">{error}</p>{/if}

    <table>
      <thead>
        <tr>
          <th scope="col">{t('summary.col.name')}</th>
          <th scope="col">{t('summary.col.variant')}</th>
          <th scope="col" class="num">{t('summary.col.quantity')}</th>
          <th scope="col" class="num no-print">{t('summary.col.previous')}</th>
          <th scope="col" class="no-print">{t('summary.col.entered')}</th>
        </tr>
      </thead>
      {#each groups as g (g.language)}
        <tbody>
          <tr><th scope="colgroup" colspan="5" class="group">{g.language}</th></tr>
          {#each g.rows as r (r.publicationId)}
            <tr class:big={r.bigChange}>
              <th scope="row">{r.name}</th>
              <td>{r.variant}</td>
              <td class="num">
                {#if r.units === null}
                  <span aria-hidden="true">—</span>
                  <span class="visually-hidden">{t('summary.notCountedCell')}</span>
                {:else}{fmtNumber(Math.round(r.units), 0)}{/if}
                {#if r.attention}<span class="bad">{t('summary.attention')}</span>{/if}
                {#if r.bigChange}<span class="bad no-print"><span aria-hidden="true">⚠️</span> {t('summary.bigChange')}</span>{/if}
              </td>
              <td class="num no-print">{r.previous === null ? '—' : fmtNumber(Math.round(r.previous), 0)}</td>
              <td class="no-print">
                <input type="checkbox" checked={r.entered} aria-label={t('summary.enteredFor', { name: r.name })}
                  onchange={(e) => act((ds) => setEntered(ds, countId, r.publicationId, e.currentTarget.checked))} />
              </td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>

    <div class="actions no-print">
      <button type="button" onclick={() => window.print()}>{t('summary.print')}</button>
      <button type="button" onclick={excel}>{t('summary.excel')}</button>
      {#if finished}
        <button type="button" onclick={reopen}>{t('summary.reopen')}</button>
      {:else}
        <button type="button" class="primary" onclick={() => (notCounted > 0 ? (confirmFinish = true) : finish())}>{t('summary.finish')}</button>
      {/if}
    </div>
  </section>

  <ConfirmDialog open={confirmFinish} title={t('summary.finishConfirmTitle')}
    message={t('summary.finishConfirmMessage', { count: notCounted })} confirmLabel={t('summary.finishConfirm')}
    onconfirm={finish} oncancel={() => (confirmFinish = false)} />
  <ConfirmDialog open={handover} title={t('summary.handoverTitle')} message={t('summary.handoverMessage')}
    confirmLabel={t('summary.handoverConfirm')} onconfirm={exportFile} oncancel={() => (handover = false)} />
{/if}

<style>
  button { min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 16px; }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .warn { background: var(--warn-bg); color: var(--warn-text); font-weight: 700; margin-bottom: 8px; }
  .muted { color: var(--muted); }
  .err, .bad { color: var(--bad); }
  .bad { display: block; font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 8px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  th[scope='row'] { font-weight: 600; }
  .num { text-align: right; }
  .group { background: var(--surface); }
  tr.big { background: var(--warn-bg); }
  td input { width: 24px; height: 24px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
