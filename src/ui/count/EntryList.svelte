<script lang="ts">
  import { untrack } from 'svelte';
  import { act } from '../../store/app.svelte';
  import { fmtNumber, t } from '../../i18n/index.svelte';
  import { updateEntry } from '../../domain/dataset';
  import { capacityG, checkWeighing, itemTotal } from '../../domain/calc';
  import type { WeighingIssue } from '../../domain/calc';
  import { parseDecimal, toGrams } from '../../domain/units';
  import type { CountItem, Entry, ScaleRange, WeightUnit } from '../../domain/types';
  import Icon from '../shared/Icon.svelte';
  import { errorMessage, parseWhole } from './errors';
  import { totalText } from './item-format';

  const { item, unit, scale, editable, countId, pubId, fmtW, plain, unitsOf, run, onerror, onresample, ondelete }: {
    item: CountItem; unit: WeightUnit; scale: ScaleRange[] | null; editable: boolean; countId: string; pubId: string;
    fmtW: (g: number) => string; plain: (g: number) => string; unitsOf: (g: number) => number | null;
    run: (fn: () => void) => boolean; onerror: (msg: string) => void; onresample: () => void; ondelete: (id: string) => void;
  } = $props();

  let showAll = $state(false);
  const ordered = $derived([...item.entries].reverse());
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
    onerror('');
    editPending = null;
    const [a, b] = e.kind === 'weighing' ? [plain(e.weightG), '']
      : e.kind === 'sealed' ? [String(e.packs), String(e.perPack)]
      : [String(e.units), ''];
    editing = { id: e.id, a, b, a0: a, b0: b };
  }
  const draft = $derived.by((): Entry | null => {
    const old = editing && item.entries.find((e) => e.id === editing!.id);
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
    if (!d) return null;
    try {
      const tt = itemTotal({ ...item, entries: item.entries.map((e) => (e.id === d.id ? d : e)) }, scale);
      return tt ? totalText(tt) : null;
    } catch { return null; }
  });
  function saveEdit(force = false): void {
    if (!draft || !editing) { onerror(errorMessage(new Error('invalidEntry'))); return; }
    const d = draft;
    if (editing.a === editing.a0 && editing.b === editing.b0) { editing = null; editPending = null; return; }
    if (d.kind === 'weighing' && !force) {
      let issues: WeighingIssue[] = [];
      try { issues = checkWeighing(d.weightG, { ...item, entries: item.entries.filter((e) => e.id !== d.id) }, scale); } catch { issues = []; }
      if (issues.includes('overCapacity')) {
        const cap = capacityG(scale);
        onerror(t('err.overCapacity', { cap: cap === null ? '' : fmtW(cap) }));
        editPending = null;
        return;
      }
      if (issues.length > 0) { onerror(''); editPending = issues; return; }
    }
    editPending = null;
    if (run(() => act((ds) => updateEntry(ds, countId, pubId, d.id, d)))) editing = null;
  }
  // NOTE: a pending confirmation is only valid for the entries it was computed against.
  $effect(() => {
    void item.entries.length;
    untrack(() => { editPending = null; });
  });
</script>

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
              <button type="button" onclick={onresample}>{t('item.resample')}</button>
            {:else}
              <button type="button" class="icon-btn" aria-label={t('entry.edit')} onclick={() => startEdit(e)}><Icon name="pencil" size={22} /></button>
              <button type="button" class="icon-btn danger" aria-label={t('entry.delete')} onclick={() => ondelete(e.id)}><Icon name="trash" size={22} /></button>
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

<style>
  .grid { display: grid; gap: var(--sp-2); }
  .entries { list-style: none; padding: 0; display: grid; gap: var(--sp-1); }
  .entries li { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-1) var(--sp-2); padding: 2px var(--sp-1) 2px var(--sp-3); min-height: var(--tap-lg); border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
  .entries li.editing { padding: var(--sp-3); border: 2px solid var(--accent); }
  .entries form { flex: 1; }
  .val { font-weight: 600; flex: 1; }
</style>
