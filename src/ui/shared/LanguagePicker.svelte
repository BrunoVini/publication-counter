<script lang="ts">
  import { i18n, t } from '../../i18n/index.svelte';
  import Icon from './Icon.svelte';
  import { languageEntry, languageName, languagesLoaded, loadLanguages, searchLanguages } from '../../domain/languages.svelte';

  type Props = { legend: string; required?: boolean } & (
    | { mode: 'single'; value: string; onchange: (v: string) => void }
    | { mode: 'multi'; value: string[]; onchange: (v: string[]) => void }
  );
  const props: Props = $props();

  const LIMIT = 50;
  const uid = $props.id();
  let query = $state('');
  void loadLanguages();

  const selected = $derived(props.mode === 'single' ? (props.value ? [props.value] : []) : props.value);
  // Selected entries stay on top so they can always be unticked; unknown codes still show raw.
  const hits = $derived(searchLanguages(query).filter((e) => !selected.includes(e.c)));
  const collator = $derived(new Intl.Collator(i18n.lang));
  const sorted = $derived(
    hits.map((e) => ({ c: e.c, n: languageName(e.c, i18n.lang) })).sort((a, b) => collator.compare(a.n, b.n)).slice(0, LIMIT),
  );

  function toggle(code: string, on: boolean) {
    if (props.mode === 'single') props.onchange(code);
    else props.onchange(on ? [...props.value, code] : props.value.filter((c) => c !== code));
  }
  const vernacular = (code: string): string => {
    const e = languageEntry(code);
    return e && e.v && e.v !== languageName(code, i18n.lang) ? e.v : '';
  };
</script>

<fieldset>
  <legend>{props.legend}{#if props.required} <span aria-hidden="true">*</span>{/if}</legend>
  <label class="search">
    <span class="visually-hidden">{t('lang.search')}</span>
    <Icon name="search" />
    <input type="search" placeholder={t('lang.search')} bind:value={query} autocomplete="off" />
  </label>
  <div class="opts">
    {#if !languagesLoaded()}
      <p class="muted">{t('lang.loading')}</p>
    {:else}
      {#each [...selected, ...sorted.map((e) => e.c)] as code (code)}
        <label class="check">
          <input
            type={props.mode === 'single' ? 'radio' : 'checkbox'}
            name={uid}
            checked={selected.includes(code)}
            onchange={(e) => toggle(code, e.currentTarget.checked)}
          />
          <span>{languageName(code, i18n.lang)}{#if vernacular(code)} <span class="muted">· {vernacular(code)}</span>{/if}</span>
        </label>
      {/each}
      {#if hits.length === 0}<p class="muted">{t('lang.none')}</p>{/if}
      {#if hits.length > LIMIT}<p class="muted">{t('lang.more', { count: LIMIT })}</p>{/if}
    {/if}
  </div>
</fieldset>

<style>
  fieldset { display: grid; gap: var(--sp-2); }
  .opts { max-height: 240px; overflow-y: auto; display: grid; align-content: start; }
</style>
