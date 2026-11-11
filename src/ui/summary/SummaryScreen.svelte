<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { fmtDate, fmtNumber, t } from '../../i18n/index.svelte';
  import { finishCount, reopenCount, setEntered } from '../../domain/dataset';
  import { localDate } from '../../domain/text';
  import { summaryRows } from '../../domain/summary';
  import { loadLanguages } from '../../domain/languages.svelte';
  import { exportFileName, serializeDataset } from '../../domain/file';
  import { syncNow } from '../../store/sync.svelte';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { shareOrDownload } from '../shared/fileio';
  import { exportExcel } from './excel';
  import Icon from '../shared/Icon.svelte';

  const { countId }: { countId: string } = $props();

  void loadLanguages();
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
  <section class="stack">
    <div class="no-print">
      <button type="button" onclick={() => (app.summaryCountId = null)}><Icon name="back" /> {t('item.close')}</button>
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
        <Icon name="warn" /> {t('summary.notCounted', { count: notCounted })} <Icon name="chevron" />
      </button>
    {/if}
    {#if error}<p role="alert" class="err">{error}</p>{/if}

    <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">{t('summary.col.name')}</th>
          <th scope="col" class="var">{t('summary.col.variant')}</th>
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
              <!-- NOTE: on phones the variant column is hidden and the variant shows under the name instead; only one of the two is ever rendered. -->
              <th scope="row">{r.name}{#if r.variant}<span class="var-in"> {r.variant}</span>{/if}</th>
              <td class="var">{r.variant}</td>
              <td class="num">
                {#if r.units === null}
                  <span aria-hidden="true">—</span>
                  <span class="visually-hidden">{t('summary.notCountedCell')}</span>
                {:else}{fmtNumber(Math.round(r.units), 0)}{/if}
                {#if r.attention}<span class="bad">{t('summary.attention')}</span>{/if}
                {#if r.bigChange}<span class="bad no-print"><Icon name="warn" size={16} /> {t('summary.bigChange')}</span>{/if}
              </td>
              <td class="num prev no-print">{r.previous === null ? '—' : fmtNumber(Math.round(r.previous), 0)}</td>
              <td class="no-print">
                <input type="checkbox" checked={r.entered} aria-label={t('summary.enteredFor', { name: r.name })}
                  onchange={(e) => act((ds) => setEntered(ds, countId, r.publicationId, e.currentTarget.checked))} />
              </td>
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
    </div>

    <div class="acts no-print">
      {#if finished}
        <button type="button" class="main" onclick={reopen}><Icon name="undo" /> {t('summary.reopen')}</button>
      {:else}
        <button type="button" class="primary big main" onclick={() => (notCounted > 0 ? (confirmFinish = true) : finish())}><Icon name="check" size={24} /> {t('summary.finish')}</button>
      {/if}
      <button type="button" onclick={() => window.print()}><Icon name="print" /> {t('summary.print')}</button>
      <button type="button" onclick={excel}><Icon name="table" /> {t('summary.excel')}</button>
    </div>
  </section>

  <ConfirmDialog open={confirmFinish} title={t('summary.finishConfirmTitle')}
    message={t('summary.finishConfirmMessage', { count: notCounted })} confirmLabel={t('summary.finishConfirm')}
    onconfirm={finish} oncancel={() => (confirmFinish = false)} />
  <ConfirmDialog open={handover} title={t('summary.handoverTitle')} message={t('summary.handoverMessage')}
    confirmLabel={t('summary.handoverConfirm')} onconfirm={exportFile} oncancel={() => (handover = false)} />
{/if}

<style>
  .warn { display: flex; justify-content: flex-start; width: 100%; padding-block: var(--sp-2); font-weight: 700; text-align: start; }
  .bad { display: block; font-size: var(--fs-sm); }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: var(--sp-2); border-bottom: 1px solid var(--border); text-align: start; vertical-align: top; }
  thead th { color: var(--muted); font-size: var(--fs-sm); vertical-align: bottom; }
  th[scope='row'] { font-weight: 600; overflow-wrap: break-word; }
  .var-in { display: none; color: var(--muted); font-size: var(--fs-sm); font-weight: 400; }
  @media screen and (max-width: 600px) {
    .var { display: none; }
    .var-in { display: block; }
    th, td { padding: var(--sp-2) var(--sp-1); }
  }
  .num { text-align: end; font-variant-numeric: tabular-nums; }
  td.num:not(.prev) { font-size: 18px; font-weight: 700; }
  .prev { color: var(--muted); }
  .group { background: var(--surface); }
  /* NOTE: the row tint only reinforces the "changed a lot" text shown in the quantity cell. */
  tr.big { background: var(--warn-bg); }
  tr.big .prev { color: inherit; }
  .acts { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .acts button { flex: 1; }
  .acts .main { flex: 1 0 100%; }
  @media print { td.num:not(.prev) { font-size: inherit; } }
</style>
