<script lang="ts">
  import { fmtNumber, t } from '../../i18n/index.svelte';
  import { parseDecimal, toGrams } from '../../domain/units';
  import type { WeightUnit } from '../../domain/types';

  let { unit, onadd, previewUnits, onunit, oninput }: {
    unit: WeightUnit;
    /** Return false to keep the typed value (blocked or waiting for confirmation). */
    onadd: (grams: number) => boolean | void;
    previewUnits: (grams: number) => number | null;
    onunit?: () => void;
    oninput?: () => void;
  } = $props();

  let text = $state('');
  let invalid = $state(false);
  let input: HTMLInputElement;

  // NOTE: jsdom has no matchMedia; without it the hint is shown as on a desktop.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const grams = $derived.by(() => {
    const v = parseDecimal(text);
    return v !== null && v > 0 ? toGrams(v, unit) : null;
  });
  const preview = $derived(grams === null ? null : previewUnits(grams));

  export function focus(): void { input?.focus(); }
  export function clear(): void { text = ''; invalid = false; }

  function add(): void {
    if (grams === null) { invalid = true; return; }
    invalid = false;
    if (onadd(grams) !== false) text = '';
    input.focus();
  }
</script>

<div class="wi">
  <label class="lbl" for="wi-input">{t('weight.label')}</label>
  <div class="inrow">
    <input id="wi-input" bind:this={input} type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
      bind:value={text} aria-invalid={invalid} aria-describedby="wi-preview"
      oninput={() => { invalid = false; oninput?.(); }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    <button type="button" class="unit" aria-label={t('weight.unit', { unit })} onclick={() => onunit?.()}>{unit}</button>
  </div>
  <p id="wi-preview" class="preview">{#if preview !== null}{t('weight.preview', { n: fmtNumber(preview, preview < 100 ? 1 : 0) })}{/if}</p>
  {#if invalid}<p class="err" role="alert">{t('weight.invalid')}</p>{/if}
  <button type="button" class="primary big" onclick={add}>{t('weight.add')}{#if !touch} <span aria-hidden="true">↵</span>{/if}</button>
</div>

<style>
  .wi { display: grid; gap: var(--sp-1); }
  .lbl { font-weight: 600; }
  .inrow { display: flex; gap: var(--sp-2); }
  /* NOTE: the one field typed into all day: largest type on the screen and an accent border. */
  .inrow input { flex: 1; min-width: 0; min-height: var(--tap-lg); font-size: 24px; border: 2px solid var(--accent); }
  .unit { min-width: 64px; min-height: var(--tap-lg); font-size: var(--fs-lg); font-weight: 700; }
  .preview { min-height: 1.45em; color: var(--muted); }
</style>
