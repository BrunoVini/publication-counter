<script lang="ts">
  import { untrack } from 'svelte';
  import { app } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';
  import { validateScale } from '../../domain/calc';
  import { fromGrams, parseDecimal, toGrams } from '../../domain/units';
  import type { ScaleRange } from '../../domain/types';

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
      <label>{t('scale.upTo', { unit })} <span aria-hidden="true">*</span><input type="text" inputmode="decimal" aria-required="true" bind:value={row.upTo} /></label>
      <label>{t('scale.resolution', { unit })} <span aria-hidden="true">*</span><input type="text" inputmode="decimal" aria-required="true" bind:value={row.res} /></label>
      <button type="button" aria-label={t('scale.removeRow', { n: i + 1 })} onclick={() => rows.splice(i, 1)}>×</button>
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
  .scale { display: grid; gap: 8px; }
  h3 { margin: 0; }
  fieldset { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; border: 1px solid var(--border); border-radius: 10px; }
  label { display: grid; gap: 2px; flex: 1; min-width: 120px; }
  input { min-height: 44px; font-size: 1rem; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .muted { margin: 0; color: var(--muted); }
  .bad { margin: 0; color: var(--bad); }
</style>
