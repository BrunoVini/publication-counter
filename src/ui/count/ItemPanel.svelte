<script lang="ts">
  import { untrack } from 'svelte';
  import { app, act } from '../../store/app.svelte';
  import { fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { addEntry, deleteEntry, markZero, openCount, resetItem, updateEntry, updatePublication } from '../../domain/dataset';
  import { capacityG, checkWeighing, fractionWarning, itemTotal, unitWeightG } from '../../domain/calc';
  import type { ItemTotal, WeighingIssue } from '../../domain/calc';
  import { fromGrams, parseDecimal, toGrams } from '../../domain/units';
  import type { Entry } from '../../domain/types';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import SampleForm from './SampleForm.svelte';
  import WeightInput from './WeightInput.svelte';
  import Icon from '../shared/Icon.svelte';
  import { errorMessage, parseWhole } from './errors';

  let { countId, pubId }: { countId: string; pubId: string } = $props();

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

  const summary = $derived.by((): { total: ItemTotal | null; attention: boolean } => {
    if (!item) return { total: null, attention: false };
    try { return { total: itemTotal(item, scale), attention: false }; } catch { return { total: null, attention: true }; }
  });
  const totalText = (tt: ItemTotal): string =>
    tt.margin > 0 ? t('item.total', { n: fmtNumber(tt.units, 0), m: fmtNumber(tt.margin, 0) }) : fmtNumber(tt.units, 0);
  const headerText = $derived(
    summary.attention ? t('count.status.attention') : summary.total ? totalText(summary.total) : t('count.status.none'),
  );

  let error = $state('');
  let wi: WeightInput | undefined = $state();
  let packsInput: HTMLInputElement | undefined = $state();
  let handInput: HTMLInputElement | undefined = $state();
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
    untrack(() => { pending = null; editPending = null; });
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

  function addSealed(): void {
    const packs = parseWhole(packsText);
    const perPack = parseWhole(perPackText);
    if (packs === null || perPack === null) { formError = t('sealed.invalid'); return; }
    formError = '';
    let entry: Entry | undefined;
    const ok = run(() => {
      entry = act((ds) => {
        const e = addEntry(ds, countId, pubId, { kind: 'sealed', packs, perPack }, uid);
        if (pub?.packSize !== perPack) updatePublication(ds, pubId, { packSize: perPack });
        return e;
      });
    });
    if (!ok) return;
    announce(entry!, packs * perPack);
    packsText = '';
    packsInput?.focus();
  }
  function addHand(): void {
    const units = parseWhole(handText);
    if (units === null) { formError = t('hand.invalid'); return; }
    formError = '';
    let entry: Entry | undefined;
    if (!run(() => { entry = act((ds) => addEntry(ds, countId, pubId, { kind: 'hand', units }, uid)); })) return;
    announce(entry!, units);
    handText = '';
    handInput?.focus();
  }

  // Entries list and inline edit
  let showAll = $state(false);
  const ordered = $derived(item ? [...item.entries].reverse() : []);
  const shown = $derived(showAll ? ordered : ordered.slice(0, 3));
  const unitsOfEntry = (e: Entry): number | null =>
    e.kind === 'weighing' ? unitsOf(e.weightG) : e.kind === 'sealed' ? e.packs * e.perPack : e.units;
  const entryText = (e: Entry): string =>
    e.kind === 'weighing' ? t('entry.weighing', { value: fmtW(e.weightG) })
    : e.kind === 'sealed' ? t('entry.sealed', { packs: fmtNumber(e.packs, 0), perPack: fmtNumber(e.perPack, 0) })
    : e.kind === 'hand' ? t('entry.hand', { units: fmtNumber(e.units, 0) })
    : t('entry.sample', { units: fmtNumber(e.units, 0), value: fmtW(e.weightG) });

  let editing = $state<{ id: string; a: string; b: string; a0: string; b0: string } | null>(null);
  let editPending = $state<WeighingIssue[] | null>(null);
  function startEdit(e: Entry): void {
    if (e.kind === 'sample') return;
    error = '';
    editPending = null;
    const [a, b] = e.kind === 'weighing' ? [plain(e.weightG), '']
      : e.kind === 'sealed' ? [String(e.packs), String(e.perPack)]
      : [String(e.units), ''];
    editing = { id: e.id, a, b, a0: a, b0: b };
  }
  const draft = $derived.by((): Entry | null => {
    const old = editing && item?.entries.find((e) => e.id === editing!.id);
    if (!editing || !old) return null;
    if (old.kind === 'weighing') {
      const v = parseDecimal(editing.a);
      return v !== null && v > 0 ? { ...old, weightG: toGrams(v, unit) } : null;
    }
    if (old.kind === 'sealed') {
      const packs = parseWhole(editing.a);
      const perPack = parseWhole(editing.b);
      return packs !== null && perPack !== null ? { ...old, packs, perPack } : null;
    }
    if (old.kind === 'hand') {
      const units = parseWhole(editing.a);
      return units !== null ? { ...old, units } : null;
    }
    return null;
  });
  const draftTotal = $derived.by((): string | null => {
    const d = draft;
    if (!d || !item) return null;
    try {
      const tt = itemTotal({ ...item, entries: item.entries.map((e) => (e.id === d.id ? d : e)) }, scale);
      return tt ? totalText(tt) : null;
    } catch { return null; }
  });
  function saveEdit(force = false): void {
    if (!draft || !editing) { error = errorMessage(new Error('invalidEntry')); return; }
    const d = draft;
    if (editing.a === editing.a0 && editing.b === editing.b0) { editing = null; editPending = null; return; }
    if (d.kind === 'weighing' && item && !force) {
      let issues: WeighingIssue[] = [];
      try { issues = checkWeighing(d.weightG, { ...item, entries: item.entries.filter((e) => e.id !== d.id) }, scale); } catch { issues = []; }
      if (issues.includes('overCapacity')) {
        const cap = capacityG(scale);
        error = t('err.overCapacity', { cap: cap === null ? '' : fmtW(cap) });
        editPending = null;
        return;
      }
      if (issues.length > 0) { error = ''; editPending = issues; return; }
    }
    editPending = null;
    if (run(() => act((ds) => updateEntry(ds, countId, pubId, d.id, d)))) editing = null;
  }

  // Confirmations
  let confirm = $state<{ kind: 'delete'; id: string } | { kind: 'recount' } | { kind: 'zero' } | null>(null);
  const dialog = $derived.by(() => {
    const c = confirm;
    if (!c) return { title: '', message: '', label: '' };
    if (c.kind === 'recount') return { title: t('item.recount.title'), message: t('item.recount.message'), label: t('item.recount.confirm') };
    if (c.kind === 'zero') return { title: t('item.zero.title'), message: t('item.zero.message'), label: t('item.zero.confirm') };
    const e = item?.entries.find((x) => x.id === c.id);
    const message = !e || e.kind === 'sample' ? ''
      : e.kind === 'weighing' ? t('entry.delete.weighing', { value: fmtW(e.weightG) })
      : e.kind === 'sealed' ? t('entry.delete.sealed', { packs: fmtNumber(e.packs, 0), perPack: fmtNumber(e.perPack, 0) })
      : t('entry.delete.hand', { units: fmtNumber(e.units, 0) });
    return { title: t('entry.delete.title'), message, label: t('entry.delete.confirm') };
  });
  function doConfirm(): void {
    const c = confirm;
    confirm = null;
    if (!c) return;
    if (c.kind === 'delete') run(() => act((ds) => deleteEntry(ds, countId, pubId, c.id)));
    else if (c.kind === 'recount') run(() => act((ds) => resetItem(ds, countId, pubId)));
    else run(() => act((ds) => markZero(ds, countId, pubId)));
  }
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
      {:else if tab === 'sealed'}
        <form class="grid" onsubmit={(e) => { e.preventDefault(); addSealed(); }}>
          <label class="field">{t('sealed.packs')}<input bind:this={packsInput} type="text" inputmode="numeric" bind:value={packsText} /></label>
          <label class="field">{t('sealed.perPack')}<input type="text" inputmode="numeric" bind:value={perPackText} /></label>
          {#if formError}<p class="bad" role="alert">{formError}</p>{/if}
          <button type="submit" class="primary big">{t('weight.add')}</button>
        </form>
      {:else}
        <form class="grid" onsubmit={(e) => { e.preventDefault(); addHand(); }}>
          <label class="field">{t('hand.units')}<input bind:this={handInput} type="text" inputmode="numeric" bind:value={handText} /></label>
          {#if formError}<p class="bad" role="alert">{formError}</p>{/if}
          <button type="submit" class="primary big">{t('weight.add')}</button>
        </form>
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

    {#if ordered.length > 0}
      <h3 class="sec">{t('entries.title')}</h3>
      <ul class="entries">
        {#each shown as e (e.id)}
          <li class:editing={editing?.id === e.id && editable}>
            {#if editing && editing.id === e.id && editable}
              <form class="grid" onsubmit={(ev) => { ev.preventDefault(); saveEdit(); }} oninput={() => (editPending = null)}>
                <p class="muted">{t('entry.edit.old', { value: entryText(e) })}</p>
                {#if e.kind === 'weighing'}
                  <label class="field">{t('entry.edit.weight', { unit })}<input type="text" inputmode="decimal" bind:value={editing.a} /></label>
                {:else if e.kind === 'sealed'}
                  <label class="field">{t('sealed.packs')}<input type="text" inputmode="numeric" bind:value={editing.a} /></label>
                  <label class="field">{t('sealed.perPack')}<input type="text" inputmode="numeric" bind:value={editing.b} /></label>
                {:else}
                  <label class="field">{t('hand.units')}<input type="text" inputmode="numeric" bind:value={editing.a} /></label>
                {/if}
                {#if editPending}
                  <div class="warn" role="alert">
                    {#each editPending as issue (issue)}<p>{t(`warn.${issue}`)}</p>{/each}
                    <div class="btn-row">
                      <button type="button" onclick={() => saveEdit(true)}>{t('warn.saveAnyway')}</button>
                      <button type="button" onclick={() => (editPending = null)}>{t('dialog.cancel')}</button>
                    </div>
                  </div>
                {/if}
                {#if draftTotal}<p class="muted" aria-live="polite">{t('entry.edit.newTotal', { total: draftTotal })}</p>{/if}
                <div class="actions">
                  <button type="button" onclick={() => (editing = null)}>{t('dialog.cancel')}</button>
                  <button type="submit" class="primary">{t('entry.save')}</button>
                </div>
              </form>
            {:else}
              {@const n = unitsOfEntry(e)}
              <span class="val">{entryText(e)}</span>
              {#if n !== null && e.kind !== 'sample'}<span class="muted">{t('entry.units', { n: fmtNumber(n, n < 100 ? 1 : 0) })}</span>{/if}
              {#if editable}
                {#if e.kind === 'sample'}
                  <button type="button" onclick={resample}>{t('item.resample')}</button>
                {:else}
                  <button type="button" class="icon-btn" aria-label={t('entry.edit')} onclick={() => startEdit(e)}><Icon name="pencil" size={22} /></button>
                  <button type="button" class="icon-btn danger" aria-label={t('entry.delete')} onclick={() => (confirm = { kind: 'delete', id: e.id })}><Icon name="trash" size={22} /></button>
                {/if}
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
      {#if ordered.length > 3}
        <button type="button" onclick={() => (showAll = !showAll)}>
          <Icon name={showAll ? 'up' : 'down'} />
          {showAll ? t('entries.showLess') : t('entries.seeAll', { count: ordered.length })}
        </button>
      {/if}
    {/if}
  {/if}
</section>

<ConfirmDialog open={confirm !== null} title={dialog.title} message={dialog.message} confirmLabel={dialog.label}
  danger onconfirm={doConfirm} oncancel={() => (confirm = null)} />

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
  .grid { display: grid; gap: var(--sp-2); }
  .more { display: flex; gap: var(--sp-2); align-items: start; flex-wrap: wrap; }
  summary { display: inline-flex; align-items: center; gap: var(--sp-1); min-height: var(--tap); padding: 0 var(--sp-3); border-radius: var(--radius); color: var(--muted); font-weight: 600; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .menu { display: grid; gap: var(--sp-2); margin-top: var(--sp-1); }
  .menu button { justify-content: flex-start; }
  .entries { list-style: none; padding: 0; display: grid; gap: var(--sp-1); }
  .entries li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1) var(--sp-2); padding: 2px var(--sp-1) 2px var(--sp-3); min-height: var(--tap-lg); border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
  .entries li.editing { padding: var(--sp-3); border: 2px solid var(--accent); }
  .entries form { flex: 1; }
  .val { font-weight: 600; flex: 1; }
</style>
