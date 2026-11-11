<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';
  import { copySample, setSample } from '../../domain/dataset';
  import { sampleAdvice } from '../../domain/calc';
  import { parseDecimal, toGrams } from '../../domain/units';
  import ScaleEditor from '../settings/ScaleEditor.svelte';
  import { errorMessage, parseWhole } from './errors';

  let { countId, pubId, onsaved, oncancel }: {
    countId: string; pubId: string;
    /** `units` is the sample size to keep aside; undefined when the weight was copied instead. */
    onsaved: (r: { units?: number; replacedPrevious: boolean }) => void;
    oncancel?: () => void;
  } = $props();

  const unit = $derived(app.ds.settings.unit);
  let skipScale = $state(false);
  // NOTE: the scale is asked only for a publication's first sample, never when re-weighing.
  const hadSample = !!app.ds.publications.find((p) => p.id === pubId)?.sample;
  const askScale = $derived(app.ds.settings.scale === null && !skipScale && !hadSample);

  let unitsText = $state('');
  let weightText = $state('');
  let copyFrom = $state('');
  let error = $state('');

  const sources = $derived(app.ds.publications.filter((p) => p.id !== pubId && p.sample));
  const parsed = $derived.by(() => {
    const units = parseWhole(unitsText);
    const w = parseDecimal(weightText);
    return units !== null && w !== null && w > 0 ? { units, weightG: toGrams(w, unit) } : null;
  });
  const advice = $derived(parsed ? sampleAdvice(parsed, app.ds.settings.scale) : null);

  function save(): void {
    if (!parsed) { error = t('sample.invalid'); return; }
    try {
      const r = act((ds) => setSample(ds, countId, pubId, parsed, () => crypto.randomUUID()));
      error = '';
      onsaved({ units: parsed.units, replacedPrevious: r.replacedPrevious });
    } catch (e) { error = errorMessage(e); }
  }

  function copy(): void {
    if (!copyFrom) return;
    try {
      act((ds) => copySample(ds, copyFrom, pubId));
      error = '';
      onsaved({ replacedPrevious: false });
    } catch (e) { error = errorMessage(e); }
  }
</script>

{#if askScale}
  <div class="form">
    <ScaleEditor scale={[]} onsave={(s) => act((ds) => { ds.settings.scale = s; })} oncancel={() => (skipScale = true)} cancelLabel={t('scale.later')} />
  </div>
{:else}
  <form class="form" onsubmit={(e) => { e.preventDefault(); save(); }}>
    <h3>{t('sample.title')}</h3>
    <label>{t('sample.units')}<input type="text" inputmode="numeric" bind:value={unitsText} /></label>
    <label>{t('sample.weight', { unit })}<input type="text" inputmode="decimal" bind:value={weightText} /></label>
    <p class="advice" aria-live="polite">
      {#if advice}{advice.ok ? t('sample.adviceOk') : t('sample.advice', { n: advice.suggestedUnits })}{/if}
    </p>
    {#if error}<p class="bad" role="alert">{error}</p>{/if}
    <div class="actions">
      {#if oncancel}<button type="button" onclick={oncancel}>{t('sample.cancel')}</button>{/if}
      <button type="submit" class="primary">{t('sample.save')}</button>
    </div>
    {#if sources.length > 0}
      <div class="copy">
        <label>{t('sample.copy.label')}
          <select bind:value={copyFrom}>
            <option value="">{t('sample.copy.choose')}</option>
            {#each sources as p (p.id)}<option value={p.id}>{p.name}{p.variant ? ` (${p.variant})` : ''}</option>{/each}
          </select>
        </label>
        <button type="button" disabled={!copyFrom} onclick={copy}>{t('sample.copy.button')}</button>
      </div>
    {/if}
  </form>
{/if}

<style>
  .form { display: grid; gap: 8px; }
  h3 { margin: 0; }
  label { display: grid; gap: 2px; font-weight: 600; }
  input, select { min-height: 44px; font-size: 1rem; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font-weight: 400; }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .actions, .copy { display: flex; gap: 8px; align-items: end; }
  .copy label { flex: 1; }
  .actions { justify-content: flex-end; }
  .advice { margin: 0; min-height: 1.4em; color: var(--muted); }
  .bad { margin: 0; color: var(--bad); }
</style>
