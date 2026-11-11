<script lang="ts">
  import { untrack } from 'svelte';
  import { app, act } from '../../store/app.svelte';
  import { i18n, t } from '../../i18n/index.svelte';
  import { addPublication, openCount, archivePublication, copySample, deletePublication, updatePublication } from '../../domain/dataset';
  import { languageName } from '../../domain/languages.svelte';
  import { parseDecimal, toGrams } from '../../domain/units';
  import { errorMessage, parseWhole } from '../count/errors';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import LanguageSelect from '../shared/LanguageSelect.svelte';
  import Icon from '../shared/Icon.svelte';
  import type { Form } from './publication-form';

  // NOTE: the form is owned here and re-created (keyed) by the parent whenever another one is opened.
  const { initial, onclose }: { initial: Form; onclose: () => void } = $props();
  const form = $state(untrack(() => initial));
  const closeForm = () => onclose();

  const langName = (code: string) => languageName(code, i18n.lang);
  const unit = $derived(app.ds.settings.unit);
  let dupError = $state('');
  let formError = $state('');
  const variants = $derived([...new Set(app.ds.publications.map((p) => p.variant).filter(Boolean))].sort());
  const withSample = $derived(app.ds.publications.filter((p) => p.sample && p.id !== form.id));

  function fail(e: unknown) {
    if (e instanceof Error && e.message === 'duplicate') dupError = errorMessage(e);
    else formError = errorMessage(e);
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
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
    if (!form.id) return;
    const id = form.id;
    try { act((ds) => archivePublication(ds, id, true)); closeForm(); } catch (err) { fail(err); }
  }

  let confirmDelete = $state(false);
  const openItem = $derived(form.id ? openCount(app.ds)?.items.find((i) => i.publicationId === form.id) : undefined);
  const hasOpenEntries = $derived(!!openItem && (openItem.entries.length > 0 || openItem.zero));
  const deleteMessage = $derived(t('pubs.delete.message') + (hasOpenEntries ? ' ' + t('pubs.delete.openWarn') : ''));
  function remove() {
    confirmDelete = false;
    if (!form.id) return;
    const id = form.id;
    try { act((ds) => deletePublication(ds, id)); if (app.openItemId === id) app.openItemId = null; closeForm(); } catch (err) { fail(err); }
  }
</script>

<form class="card panel stack" onsubmit={save} aria-label={t(form.id ? 'pubs.edit' : 'pubs.new')}>
  <p class="muted">{t('form.required')}</p>
  <label class="field">
    <span>{t('pubs.name')} <span aria-hidden="true">*</span></span>
    <input aria-required="true" maxlength="200" bind:value={form.name} autocomplete="off" aria-invalid={!!dupError} aria-describedby={dupError ? 'pub-dup' : undefined} />
  </label>
  {#if dupError}<p id="pub-dup" role="alert" class="err">{dupError}</p>{/if}
  <div class="field">
    <span>{t('pubs.language')}</span>
    <LanguageSelect label={t('pubs.language')} bind:value={form.language} />
  </div>
  <label class="field">
    <span>{t('pubs.variant')}</span>
    <input maxlength="200" list="pub-variants" bind:value={form.variant} autocomplete="off" />
  </label>
  <datalist id="pub-variants">{#each variants as v (v)}<option value={v}></option>{/each}</datalist>

  <fieldset class="stack">
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
            <option value={p.id}>{[p.name, langName(p.language), p.variant].filter(Boolean).join(' · ')}</option>
          {/each}
        </select>
      </label>
    {/if}
    {#if openItem && openItem.entries.length > 0}<p class="muted" role="note">{t('pubs.sampleOpenNote')}</p>{/if}
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
    {#if form.id}<button type="button" class="danger" onclick={() => (confirmDelete = true)}><Icon name="trash" /> {t('pubs.delete')}</button>{/if}
    <button type="button" onclick={closeForm}>{t('dialog.cancel')}</button>
    <button type="submit" class="primary">{t('pubs.save')}</button>
  </div>
</form>

<ConfirmDialog open={confirmDelete} title={t('pubs.delete.title', { name: form.name ?? '' })} message={deleteMessage}
  confirmLabel={t('pubs.delete.confirm')} danger onconfirm={remove} oncancel={() => (confirmDelete = false)} />

<style>
  .panel { margin: var(--sp-3) 0; max-width: 520px; background: var(--surface); }
  .panel .actions button { flex: 1 1 auto; }
</style>
