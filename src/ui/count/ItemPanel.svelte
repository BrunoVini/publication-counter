<script lang="ts">
  import { untrack } from 'svelte';
  import { app, act } from '../../store/app.svelte';
  import { fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { addEntry, deleteEntry, markZero, openCount } from '../../domain/dataset';
  import { capacityG, checkWeighing, fractionWarning, unitWeightG } from '../../domain/calc';
  import type { WeighingIssue } from '../../domain/calc';
  import { fromGrams } from '../../domain/units';
  import type { Entry } from '../../domain/types';
    import { showToast } from '../shared/Toast.svelte';
  import SampleForm from './SampleForm.svelte';
  import WeightInput from './WeightInput.svelte';
  import Icon from '../shared/Icon.svelte';
  import { errorMessage } from './errors';
  import { itemSummary, totalText, type Confirm } from './item-format';
  import ItemConfirm from './ItemConfirm.svelte';
  import EntryList from './EntryList.svelte';
  import QuantityForms from './QuantityForms.svelte';

  const { countId, pubId }: { countId: string; pubId: string } = $props();

  type Tab = 'weigh' | 'sealed' | 'hand';
  const uid = () => crypto.randomUUID();

  const pub = $derived(app.ds.publications.find((p) => p.id === pubId));
  const count = $derived(app.ds.counts.find((c) => c.id === countId));
  const item = $derived(count?.items.find((i) => i.publicationId === pubId));
  const unit = $derived(app.ds.settings.unit);
  const scale = $derived(app.ds.settings.scale);
  const editable = $derived(!!count && !count.finishedAt && openCount(app.ds)?.id === countId);

  let tabChoice = $state<Tab | null>(null);
  const tab = $derived<Tab>(tabChoice ?? (pub?.defaultMode === 'hand' ? 'hand' : 'weigh'));

  const summary = $derived(itemSummary(item, scale));
  const headerText = $derived(
    summary.attention ? t('count.status.attention') : summary.total ? totalText(summary.total) : t('count.status.none'),
  );

  let error = $state('');
  let wi: WeightInput | undefined = $state();
  let menu: HTMLDetailsElement | undefined = $state();

  function run(fn: () => void): boolean {
    try { fn(); error = ''; return true; } catch (e) { error = errorMessage(e); return false; }
  }

  const fmtW = (g: number): string => `${fmtNumber(fromGrams(g, unit), 3)} ${unit}`;
  // NOTE: edit fields are prefilled with the locale decimal separator; parseDecimal accepts both.
  const plain = (g: number): string =>
    String(Number(fromGrams(g, unit).toPrecision(6))).replace('.', i18n.lang === 'en' ? '.' : ',');
  const unitsOf = (g: number): number | null => {
    try { return item?.sample ? g / unitWeightG(item.sample) : null; } catch { return null; }
  };

  // Undo: ids added during this panel session, newest last.
  const added: string[] = [];
  function undo(id: string): void {
    const i = added.indexOf(id);
    if (i >= 0) added.splice(i, 1);
    if (!item?.entries.some((e) => e.id === id)) return;
    run(() => act((ds) => deleteEntry(ds, countId, pubId, id)));
  }
  function announce(e: Entry, units: number): void {
    added.push(e.id);
    showToast(t('item.added', { count: Math.round(units) }), { label: t('item.undo'), run: () => undo(e.id) });
  }
  function onKey(e: KeyboardEvent): void {
    if (!editable || document.querySelector('dialog[open]') || e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
    const el = e.target;
    if (el instanceof Element && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const last = added[added.length - 1];
    if (!last) return;
    e.preventDefault();
    undo(last);
  }

  // Weighing
  let pending = $state<{ grams: number; issues: WeighingIssue[] } | null>(null);
  // NOTE: a pending confirmation is only valid for the entries it was computed against.
  $effect(() => {
    void item?.entries.length;
    untrack(() => { pending = null; });
  });

  function commitWeighing(grams: number): boolean {
    let entry: Entry | undefined;
    if (!run(() => { entry = act((ds) => addEntry(ds, countId, pubId, { kind: 'weighing', weightG: grams }, uid)); })) return false;
    announce(entry!, unitsOf(grams) ?? 0);
    return true;
  }
  function onAddWeight(grams: number): boolean {
    pending = null;
    let issues: WeighingIssue[] = [];
    try { issues = item ? checkWeighing(grams, item, scale) : []; } catch { issues = []; }
    if (issues.includes('overCapacity')) {
      const cap = capacityG(scale);
      error = t('err.overCapacity', { cap: cap === null ? '' : fmtW(cap) });
      return false;
    }
    if (issues.length > 0) { error = ''; pending = { grams, issues }; return false; }
    return commitWeighing(grams);
  }
  function addAnyway(): void {
    if (!pending) return;
    const g = pending.grams;
    pending = null;
    if (commitWeighing(g)) wi?.clear();
    wi?.focus();
  }

  // Sealed and hand count
  let packsText = $state('');
  let perPackText = $state(untrack(() => (pub?.packSize ? String(pub.packSize) : '')));
  let handText = $state('');
  let formError = $state('');

  // Confirmations
  let confirm = $state<Confirm | null>(null);
  const onZero = (): void => {
    if (item && item.entries.length > 0) confirm = { kind: 'zero' };
    else run(() => act((ds) => markZero(ds, countId, pubId)));
  };

  // Sample
  let sampleOpen = $state(false);
  let notice = $state<{ units?: number; replaced: boolean } | null>(null);
  const needSample = $derived(editable && !!item && (sampleOpen || (tab === 'weigh' && !item.sample)));
  function onSampleSaved(r: { units?: number; replacedPrevious: boolean }): void {
    sampleOpen = false;
    error = '';
    notice = { units: r.units, replaced: r.replacedPrevious };
  }
  function resample(): void {
    if (menu) menu.open = false;
    sampleOpen = true;
  }
  function recount(): void {
    if (menu) menu.open = false;
    confirm = { kind: 'recount' };
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="panel" aria-label={pub?.name}>
  <header>
    <div class="head">
      <h2>{pub?.name}</h2>
      <button type="button" onclick={() => (app.openItemId = null)}><Icon name="close" /> {t('item.close')}</button>
    </div>
    <p class="total" class:bad={summary.attention} class:none={!summary.attention && !summary.total} aria-live="polite">{headerText}</p>
  </header>

  {#if item}
    {#if summary.total && fractionWarning(summary.total)}<p class="warn">{t('item.fraction')}</p>{/if}
    {#if error}<p class="bad" role="alert">{error}</p>{/if}

    {#if !editable}
      <p class="muted">{t('item.finished')}</p>
    {:else}
      {#if notice}
        <div class="warn" role="status">
          {#if notice.units}<p>{t('sample.keepAside', { count: notice.units })}</p>{:else}<p>{t('sample.copied')}</p>{/if}
          {#if notice.replaced}<p>{t('sample.replaced')}</p>{/if}
          <button type="button" onclick={() => (notice = null)}><Icon name="check" /> {t('sample.ok')}</button>
        </div>
      {/if}

      <div role="tablist" aria-label={t('item.tabs')} class="tabs">
        {#each ['weigh', 'sealed', 'hand'] as const as k (k)}
          <button type="button" role="tab" aria-selected={tab === k} onclick={() => { tabChoice = k; formError = ''; pending = null; }}>{t(`item.tab.${k}`)}</button>
        {/each}
      </div>

      {#if needSample}
        <SampleForm {countId} {pubId} onsaved={onSampleSaved} oncancel={sampleOpen ? () => (sampleOpen = false) : undefined} />
      {:else if tab === 'weigh'}
        <WeightInput bind:this={wi} {unit} onadd={onAddWeight} previewUnits={unitsOf}
          onunit={() => (app.tab = 'settings')} oninput={() => { pending = null; error = ''; }} />
        {#if pending}
          <div class="warn" role="alert">
            {#each pending.issues as issue (issue)}<p>{t(`warn.${issue}`)}</p>{/each}
            <div class="btn-row">
              <button type="button" onclick={addAnyway}>{t('warn.addAnyway')}</button>
              <button type="button" onclick={() => { pending = null; wi?.focus(); }}>{t('dialog.cancel')}</button>
            </div>
          </div>
        {/if}
      {:else}
        <QuantityForms {tab} {countId} {pubId} packSize={pub?.packSize} {run} {announce}
          bind:packsText bind:perPackText bind:handText bind:formError />
      {/if}

      <div class="more">
        {#if !item.zero}<button type="button" onclick={onZero}>{t('item.zero')}</button>{/if}
        <details bind:this={menu}>
          <summary aria-label={t('item.menu')}><Icon name="more" /> {t('item.menu')}</summary>
          <div class="menu">
            <button type="button" onclick={recount}><Icon name="undo" /> {t('item.recount')}</button>
            <button type="button" onclick={resample}><Icon name="scale" /> {t('item.resample')}</button>
          </div>
        </details>
      </div>
    {/if}

    <EntryList {item} {unit} {scale} {editable} {countId} {pubId} {fmtW} {plain} {unitsOf} {run}
      onerror={(m) => (error = m)} onresample={resample} ondelete={(id) => (confirm = { kind: 'delete', id })} />
  {/if}
</section>

<ItemConfirm bind:confirm {item} {countId} {pubId} {fmtW} {run} />

<style>
  .panel { display: grid; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  header { position: sticky; top: 0; z-index: 1; background: var(--surface); padding-bottom: var(--sp-1); border-bottom: 1px dashed var(--border-strong); }
  .head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); }
  .head h2 { overflow-wrap: anywhere; }
  .total { font-size: var(--fs-xl); font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
  .total.none { color: var(--todo); font-size: var(--fs-lg); }
  .total.bad { color: var(--bad); font-size: var(--fs-lg); }
  .tabs { display: flex; gap: var(--sp-1); }
  .tabs button { flex: 1; padding: 0 var(--sp-1); }
  /* NOTE: the selected tab is filled and heavier, not just a different colour. */
  .tabs button[aria-selected='true'] { background: var(--accent); color: var(--on-accent); font-weight: 700; }
  .more { display: flex; gap: var(--sp-2); align-items: start; flex-wrap: wrap; }
  summary { display: inline-flex; align-items: center; gap: var(--sp-1); min-height: var(--tap); padding: 0 var(--sp-3); border-radius: var(--radius); color: var(--muted); font-weight: 600; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .menu { display: grid; gap: var(--sp-2); margin-top: var(--sp-1); }
  .menu button { justify-content: flex-start; }
</style>
