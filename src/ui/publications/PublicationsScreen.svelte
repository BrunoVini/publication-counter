<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { i18n, t } from '../../i18n/index.svelte';
  import { archivePublication, updatePublication } from '../../domain/dataset';
  import { identityKey } from '../../domain/text';
  import { languageName, loadLanguages } from '../../domain/languages.svelte';
  import { errorMessage } from '../count/errors';
  import PasteListDialog from './PasteListDialog.svelte';
  import PublicationForm from './PublicationForm.svelte';
  import { formFor, type Form } from './publication-form';
  import LanguageSelect from '../shared/LanguageSelect.svelte';
  import Icon from '../shared/Icon.svelte';

  void loadLanguages();
  const langName = (code: string) => languageName(code, i18n.lang);

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

  // The draft from the count screen opens the form prefilled; it is consumed right away.
  let form = $state.raw<Form | null>(app.pubDraftName !== null ? formFor(undefined, app.pubDraftName) : null);
  app.pubDraftName = null;

  const norm = (s: string) => identityKey({ name: s, language: '', variant: '' }).split('\u0000')[0];
  let query = $state('');
  const live = $derived(app.ds.publications.filter((p) => !p.archived));
  const archived = $derived(app.ds.publications.filter((p) => p.archived));
  const shown = $derived(
    live.filter((p) => !query.trim() || norm(`${p.name} ${langName(p.language)} ${p.variant}`).includes(norm(query))),
  );
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
    <span class="search"><Icon name="search" /><input type="search" bind:value={query} autocomplete="off" /></span>
  </label>
  <button type="button" class="primary" onclick={() => (form = formFor())}>{t('pubs.new')}</button>
  <button type="button" onclick={() => (app.pasteOpen = true)}><Icon name="clipboard" /> {t('pubs.paste')}</button>
</div>

{#if form}
  {#key form}<PublicationForm initial={form} onclose={() => (form = null)} />{/key}
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
            <td><LanguageSelect label={t('pubs.language')} bind:value={inline.language} /></td>
            <td><input maxlength="200" aria-label={t('pubs.variant')} list="pub-variants" bind:value={inline.variant} /></td>
            <td class="acts">
              <button type="button" class="primary" onclick={saveInline}>{t('pubs.save')}</button>
              <button type="button" onclick={() => (inline = null)}>{t('dialog.cancel')}</button>
              {#if inline.error}<span role="alert" class="err">{inline.error}</span>{/if}
            </td>
          {:else}
            <td>{p.name}</td><td>{langName(p.language)}</td><td>{p.variant}</td>
            <td class="acts">
              <button type="button" onclick={() => (inline = { id: p.id, name: p.name, language: p.language, variant: p.variant, error: '' })}><Icon name="pencil" /> {t('pubs.editRow')}</button>
              <button type="button" onclick={() => (form = formFor(p))}>{t('pubs.details')}</button>
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
        <button type="button" class="row" onclick={() => (form = formFor(p))}>
          <span class="main">
            <strong>{p.name}</strong>
            <span class="sub">{[langName(p.language), p.variant].filter(Boolean).join(' · ')}</span>
          </span>
          <Icon name="chevron" />
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if archived.length}
  <button type="button" class="toggle" aria-expanded={showArchived} onclick={() => (showArchived = !showArchived)}>
    <Icon name={showArchived ? 'down' : 'chevron'} /> {t('pubs.archived', { count: archived.length })}
  </button>
  {#if showArchived}
    <ul class="list">
      {#each archived as p (p.id)}
        <li class="arch">
          <span class="main"><strong>{p.name}</strong> <span class="muted">{[langName(p.language), p.variant].filter(Boolean).join(' · ')}</span></span>
          <button type="button" onclick={() => restore(p.id)}><Icon name="undo" /> {t('pubs.restore')}</button>
          {#if restoreErr?.id === p.id}<p role="alert" class="err">{restoreErr.msg}</p>{/if}
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<PasteListDialog open={app.pasteOpen} onclose={() => (app.pasteOpen = false)} />

<style>
  .bar { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: end; margin-bottom: var(--sp-3); }
  .grow { flex: 1 1 100%; }
  .bar button { flex: 1; }
  .arch { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-1); }
  .arch .main { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .toggle { margin-top: var(--sp-4); border-color: transparent; color: var(--muted); padding: 0 var(--sp-1); }
  table { width: 100%; border-collapse: collapse; margin: var(--sp-3) 0; }
  th, td { text-align: left; padding: var(--sp-1) var(--sp-2); border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: var(--fs-sm); }
  .acts { white-space: nowrap; text-align: right; }
  .acts button { margin-left: var(--sp-1); }
  @media (min-width: 600px) { .grow { flex: 1 1 240px; } .bar button { flex: none; } }
</style>
