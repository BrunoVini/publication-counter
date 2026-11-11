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
  <label for="wi-input">{t('weight.label')}</label>
  <div class="row">
    <input id="wi-input" bind:this={input} type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
      bind:value={text} aria-invalid={invalid} aria-describedby="wi-preview"
      oninput={() => { invalid = false; oninput?.(); }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    <button type="button" class="unit" aria-label={t('weight.unit', { unit })} onclick={() => onunit?.()}>{unit}</button>
  </div>
  <p id="wi-preview" class="preview">{#if preview !== null}{t('weight.preview', { n: fmtNumber(preview, preview < 100 ? 1 : 0) })}{/if}</p>
  {#if invalid}<p class="bad" role="alert">{t('weight.invalid')}</p>{/if}
  <button type="button" class="add" onclick={add}>{t('weight.add')}{#if !touch} <span aria-hidden="true">↵</span>{/if}</button>
</div>

<style>
  .wi { display: grid; gap: 4px; }
  label { font-weight: 600; }
  .row { display: flex; gap: 8px; }
  input { flex: 1; min-width: 0; min-height: 56px; font-size: 1.5rem; padding: 0 12px; border: 2px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
  .unit { min-width: 64px; font-size: 1.5rem; font-weight: 700; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .preview { margin: 0; min-height: 1.4em; color: var(--muted); }
  .bad { margin: 0; color: var(--bad); }
  .add { min-height: 56px; font-size: 1.25rem; font-weight: 700; border: 0; border-radius: 10px; background: var(--accent); color: var(--on-accent); }
</style>
