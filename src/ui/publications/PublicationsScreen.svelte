<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { i18n, t } from '../../i18n/index.svelte';
  import { addPublication, archivePublication, copySample, updatePublication } from '../../domain/dataset';
  import { identityKey } from '../../domain/text';
  import { fromGrams, parseDecimal, toGrams } from '../../domain/units';
  import type { Publication } from '../../domain/types';
  import { errorMessage, parseWhole } from '../count/errors';
  import PasteListDialog from './PasteListDialog.svelte';

  // NOTE: jsdom has no matchMedia; without it the layout defaults to phone.
  let desktop = $state(false);
  $effect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 900px)');
    desktop = mq.matches;
    const on = (e: MediaQueryListEvent) => (desktop = e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  });

  const unit = $derived(app.ds.settings.unit);
  const plain = (g: number): string =>
    String(Number(fromGrams(g, unit).toPrecision(6))).replace('.', i18n.lang === 'en' ? '.' : ',');

  interface Form {
    id: string | null; name: string; language: string; variant: string;
    units: string; weight: string; origUnits: string; origWeight: string; copyFrom: string; packSize: string; mode: 'weigh' | 'hand';
  }
  const blank = (name = ''): Form =>
    ({ id: null, name, language: '', variant: '', units: '', weight: '', origUnits: '', origWeight: '', copyFrom: '', packSize: '', mode: 'weigh' });

  // The draft from the count screen opens the form prefilled; it is consumed right away.
  let form = $state<Form | null>(app.pubDraftName !== null ? blank(app.pubDraftName) : null);
  app.pubDraftName = null;
  let dupError = $state('');
  let formError = $state('');

  const norm = (s: string) => identityKey({ name: s, language: '', variant: '' }).split('\u0000')[0];
  let query = $state('');
  const live = $derived(app.ds.publications.filter((p) => !p.archived));
  const archived = $derived(app.ds.publications.filter((p) => p.archived));
  const shown = $derived(
    live.filter((p) => !query.trim() || norm(`${p.name} ${p.language} ${p.variant}`).includes(norm(query))),
  );
  const distinct = (pick: (p: Publication) => string) =>
    [...new Set(app.ds.publications.map(pick).filter(Boolean))].sort();
  const languages = $derived(distinct((p) => p.language));
  const variants = $derived(distinct((p) => p.variant));
  const withSample = $derived(app.ds.publications.filter((p) => p.sample && p.id !== form?.id));

  function openForm(p?: Publication) {
    dupError = ''; formError = '';
    const units = p?.sample ? String(p.sample.units) : '', weight = p?.sample ? plain(p.sample.weightG) : '';
    form = p ? {
      id: p.id, name: p.name, language: p.language, variant: p.variant,
      units, weight, origUnits: units, origWeight: weight,
      copyFrom: '', packSize: p.packSize ? String(p.packSize) : '', mode: p.defaultMode,
    } : blank();
  }
  const closeForm = () => { form = null; dupError = ''; formError = ''; };

  function fail(e: unknown) {
    if (e instanceof Error && e.message === 'duplicate') dupError = errorMessage(e);
    else formError = errorMessage(e);
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (!form) return;
    dupError = ''; formError = '';
    const f = form;
    const hasUnits = f.units.trim() !== '', hasWeight = f.weight.trim() !== '';
    let sample: { units: number; weightG: number } | undefined;
    // NOTE: the prefilled weight is rounded for display, so an untouched sample keeps its stored grams.
    const stored = f.id ? app.ds.publications.find((p) => p.id === f.id)?.sample : undefined;
    if (!f.copyFrom && stored && f.units === f.origUnits && f.weight === f.origWeight) {
      sample = { ...stored };
    } else if (!f.copyFrom && (hasUnits || hasWeight)) {
      const units = parseWhole(f.units), w = parseDecimal(f.weight);
      if (units === null || w === null || w <= 0) { formError = t('pubs.err.sample'); return; }
      sample = { units, weightG: toGrams(w, unit) };
    }
    const pack = f.packSize.trim() === '' ? undefined : parseWhole(f.packSize);
    if (pack === null) { formError = t('pubs.err.packSize'); return; }
    const base = { name: f.name.trim(), language: f.language.trim(), variant: f.variant.trim(), defaultMode: f.mode, packSize: pack, sample };
    try {
      act((ds) => {
        const id = f.id ?? addPublication(ds, base, () => crypto.randomUUID()).id;
        if (f.id) updatePublication(ds, f.id, base);
        if (f.copyFrom) copySample(ds, f.copyFrom, id);
      });
      closeForm();
    } catch (err) { fail(err); }
  }

  function archive() {
    if (!form?.id) return;
    const id = form.id;
    try { act((ds) => archivePublication(ds, id, true)); closeForm(); } catch (err) { fail(err); }
  }

  let showArchived = $state(false);
  let restoreErr = $state<{ id: string; msg: string } | null>(null);
  function restore(id: string) {
    restoreErr = null;
    try { act((ds) => archivePublication(ds, id, false)); } catch (e) { restoreErr = { id, msg: errorMessage(e) }; }
  }

  // Inline row editing (desktop table).
  let inline = $state<{ id: string; name: string; language: string; variant: string; error: string } | null>(null);
  function saveInline() {
    if (!inline) return;
    const { id, name, language, variant } = inline;
    try {
      act((ds) => updatePublication(ds, id, { name: name.trim(), language: language.trim(), variant: variant.trim() }));
      inline = null;
    } catch (e) { if (inline) inline.error = errorMessage(e); }
  }
</script>

<div class="bar">
  <label class="field grow">
    <span>{t('pubs.search')}</span>
    <input type="search" bind:value={query} autocomplete="off" />
  </label>
  <button type="button" class="primary" onclick={() => openForm()}>{t('pubs.new')}</button>
  <button type="button" onclick={() => (app.pasteOpen = true)}>{t('pubs.paste')}</button>
</div>

{#if form}
  <form class="panel" onsubmit={save} aria-label={t(form.id ? 'pubs.edit' : 'pubs.new')}>
    <label class="field">
      <span>{t('pubs.name')}</span>
      <input maxlength="200" bind:value={form.name} autocomplete="off" aria-invalid={!!dupError} aria-describedby={dupError ? 'pub-dup' : undefined} />
    </label>
    {#if dupError}<p id="pub-dup" role="alert" class="err">{dupError}</p>{/if}
    <label class="field">
      <span>{t('pubs.language')}</span>
      <input maxlength="200" list="pub-langs" bind:value={form.language} autocomplete="off" />
    </label>
    <label class="field">
      <span>{t('pubs.variant')}</span>
      <input maxlength="200" list="pub-variants" bind:value={form.variant} autocomplete="off" />
    </label>
    <datalist id="pub-langs">{#each languages as l (l)}<option value={l}></option>{/each}</datalist>
    <datalist id="pub-variants">{#each variants as v (v)}<option value={v}></option>{/each}</datalist>

    <fieldset>
      <legend>{t('pubs.unitWeight')}</legend>
      <label class="field">
        <span>{t('pubs.sampleUnits')}</span>
        <input inputmode="numeric" bind:value={form.units} disabled={!!form.copyFrom} autocomplete="off" />
      </label>
      <label class="field">
        <span>{t('pubs.sampleWeight', { unit })}</span>
        <input inputmode="decimal" bind:value={form.weight} disabled={!!form.copyFrom} autocomplete="off" />
      </label>
      {#if withSample.length}
        <label class="field">
          <span>{t('pubs.copyFrom')}</span>
          <select bind:value={form.copyFrom}>
            <option value="">{t('pubs.copyFrom.none')}</option>
            {#each withSample as p (p.id)}
              <option value={p.id}>{[p.name, p.language, p.variant].filter(Boolean).join(' · ')}</option>
            {/each}
          </select>
        </label>
      {/if}
    </fieldset>

    <label class="field">
      <span>{t('pubs.packSize')}</span>
      <input inputmode="numeric" bind:value={form.packSize} autocomplete="off" />
    </label>
    <label class="field">
      <span>{t('pubs.mode')}</span>
      <select bind:value={form.mode}>
        <option value="weigh">{t('pubs.mode.weigh')}</option>
        <option value="hand">{t('pubs.mode.hand')}</option>
      </select>
    </label>
    {#if formError}<p role="alert" class="err">{formError}</p>{/if}
    <div class="actions">
      {#if form.id}<button type="button" onclick={archive}>{t('pubs.archive')}</button>{/if}
      <button type="button" onclick={closeForm}>{t('dialog.cancel')}</button>
      <button type="submit" class="primary">{t('pubs.save')}</button>
    </div>
  </form>
{/if}

{#if live.length === 0}
  <p class="muted">{t('pubs.empty')}</p>
{:else if shown.length === 0}
  <p class="muted">{t('pubs.noMatch')}</p>
{:else if desktop}
  <table>
    <thead><tr><th>{t('pubs.name')}</th><th>{t('pubs.language')}</th><th>{t('pubs.variant')}</th><th></th></tr></thead>
    <tbody>
      {#each shown as p (p.id)}
        <tr>
          {#if inline?.id === p.id}
            <td><input maxlength="200" aria-label={t('pubs.name')} bind:value={inline.name} /></td>
            <td><input maxlength="200" aria-label={t('pubs.language')} list="pub-langs" bind:value={inline.language} /></td>
            <td><input maxlength="200" aria-label={t('pubs.variant')} list="pub-variants" bind:value={inline.variant} /></td>
            <td class="acts">
              <button type="button" class="primary" onclick={saveInline}>{t('pubs.save')}</button>
              <button type="button" onclick={() => (inline = null)}>{t('dialog.cancel')}</button>
              {#if inline.error}<span role="alert" class="err">{inline.error}</span>{/if}
            </td>
          {:else}
            <td>{p.name}</td><td>{p.language}</td><td>{p.variant}</td>
            <td class="acts">
              <button type="button" onclick={() => (inline = { id: p.id, name: p.name, language: p.language, variant: p.variant, error: '' })}>{t('pubs.editRow')}</button>
              <button type="button" onclick={() => openForm(p)}>{t('pubs.details')}</button>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <ul class="list">
    {#each shown as p (p.id)}
      <li>
        <button type="button" class="row" onclick={() => openForm(p)}>
          <strong>{p.name}</strong>
          <span class="muted">{[p.language, p.variant].filter(Boolean).join(' · ')}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if archived.length}
  <button type="button" class="toggle" aria-expanded={showArchived} onclick={() => (showArchived = !showArchived)}>
    <span aria-hidden="true">{showArchived ? '▾' : '▸'}</span> {t('pubs.archived', { count: archived.length })}
  </button>
  {#if showArchived}
    <ul class="list">
      {#each archived as p (p.id)}
        <li class="arch">
          <span><strong>{p.name}</strong> <span class="muted">{[p.language, p.variant].filter(Boolean).join(' · ')}</span></span>
          <button type="button" onclick={() => restore(p.id)}>{t('pubs.restore')}</button>
          {#if restoreErr?.id === p.id}<p role="alert" class="err">{restoreErr.msg}</p>{/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<PasteListDialog open={app.pasteOpen} onclose={() => (app.pasteOpen = false)} />

<style>
  button, input, select { min-height: 44px; font-size: 16px; }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .muted { color: var(--muted); }
  .err { color: var(--bad); }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
  .grow { flex: 1; min-width: 160px; }
  .field { display: grid; gap: 4px; margin: 8px 0; }
  input, select { padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
  .panel { border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin: 12px 0; max-width: 520px; }
  fieldset { border: 1px solid var(--border); border-radius: 10px; margin: 8px 0; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .list { list-style: none; margin: 8px 0; padding: 0; display: grid; gap: 8px; }
  .row { width: 100%; min-height: 56px; display: flex; justify-content: space-between; align-items: center; gap: 12px; text-align: left; }
  .arch { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
  .toggle { margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--border); }
  td input { width: 100%; box-sizing: border-box; }
  .acts { white-space: nowrap; text-align: right; }
</style>
