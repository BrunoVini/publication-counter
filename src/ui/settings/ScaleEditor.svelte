<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';
  import { validateScale } from '../../domain/calc';
  import { fromGrams, parseDecimal, toGrams } from '../../domain/units';
  import type { ScaleRange } from '../../domain/types';
  import Icon from '../shared/Icon.svelte';

  let { scale, onsave, oncancel, cancelLabel }: {
    scale: ScaleRange[];
    onsave: (scale: ScaleRange[]) => void;
    oncancel: () => void;
    cancelLabel?: string;
  } = $props();

  const unit = $derived(app.ds.settings.unit);
  const show = (g: number): string => String(Number(fromGrams(g, app.ds.settings.unit).toPrecision(6)));

  // NOTE: the editor takes a snapshot of the scale when it opens; it does not follow later prop changes.
  let rows = $state(
    untrack(() => scale.length > 0
      ? scale.map((r) => ({ upTo: show(r.upToG), res: show(r.resolutionG) }))
      : [{ upTo: '', res: '' }]),
  );
  let error = $state('');

  function save(): void {
    const parsed = rows.map((r) => ({ up: parseDecimal(r.upTo), res: parseDecimal(r.res) }));
    if (parsed.some((r) => r.up === null || r.res === null)) { error = t('scale.err.nonPositive'); return; }
    const next = parsed.map((r) => ({ upToG: toGrams(r.up!, unit), resolutionG: toGrams(r.res!, unit) }));
    const code = validateScale(next);
    if (code !== 'ok') { error = t(`scale.err.${code}`); return; }
    error = '';
    onsave(next);
  }
</script>

<form class="scale" onsubmit={(e) => { e.preventDefault(); save(); }}>
  <h3>{t('scale.title')}</h3>
  <p>{t('scale.help')}</p>
  <p class="muted">{t('form.required')}</p>
  {#each rows as row, i (i)}
    <fieldset>
      <legend>{t('scale.row', { n: i + 1 })}</legend>
      <label class="field">{t('scale.upTo', { unit })} <span aria-hidden="true">*</span><input type="text" inputmode="decimal" aria-required="true" bind:value={row.upTo} /></label>
      <label class="field">{t('scale.resolution', { unit })} <span aria-hidden="true">*</span><input type="text" inputmode="decimal" aria-required="true" bind:value={row.res} /></label>
      <button type="button" class="icon-btn danger" aria-label={t('scale.removeRow', { n: i + 1 })} onclick={() => rows.splice(i, 1)}><Icon name="trash" size={22} /></button>
    </fieldset>
  {/each}
  <button type="button" onclick={() => rows.push({ upTo: '', res: '' })}>{t('scale.addRow')}</button>
  {#if error}<p class="bad" role="alert">{error}</p>{/if}
  <div class="actions">
    <button type="button" onclick={oncancel}>{cancelLabel ?? t('dialog.cancel')}</button>
    <button type="submit" class="primary">{t('scale.save')}</button>
  </div>
</form>

<style>
  .scale { display: grid; gap: var(--sp-2); }
  fieldset { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: end; }
  .field { flex: 1; min-width: 120px; grid-template-columns: auto 1fr; justify-content: start; }
  .field input { grid-column: 1 / -1; }
</style>
