<script lang="ts">
  import { act, app } from '../store/app.svelte';
  import { i18n, t } from '../i18n/index.svelte';
  import type { Lang, WeightUnit } from '../domain/types';
  import { openPubcountText, pickTextFile } from './shared/fileio';
  import { isIosBrowser } from './shared/platform';
  import { DEFAULT_PUB_LANGUAGE } from '../domain/dataset';
  import { languagesLoaded, loadLanguages } from '../domain/languages.svelte';
  import LanguagePicker from './shared/LanguagePicker.svelte';
  import Icon from './shared/Icon.svelte';

  const langs: { code: Lang; name: string }[] = [
    { code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  ];
  const units: WeightUnit[] = ['g', 'kg', 'lb', 'oz'];

  // NOTE: simple heuristic: pounds only for US English devices, kilograms everywhere else.
  const defaultUnit = (): WeightUnit =>
    i18n.lang === 'en' && /-US$/i.test(navigator.language ?? '') ? 'lb' : 'kg';

  const isIos = isIosBrowser();

  let step = $state<1 | 2 | 3>(1);
  let unit = $state<WeightUnit>(defaultUnit());
  let error = $state('');
  let primary = $state(DEFAULT_PUB_LANGUAGE[i18n.lang]);
  let others = $state<string[]>([]);
  let primaryTouched = false;
  void loadLanguages();
  // NOTE: the code is preselected right away (the codes are constants); only its label needs the list.
  $effect(() => {
    if (!primaryTouched) primary = DEFAULT_PUB_LANGUAGE[i18n.lang];
  });
  // NOTE: the language default only applies while the user has not picked a unit.
  let unitTouched = false;
  let heading = $state<HTMLHeadingElement>();
  let firstRender = true;
  $effect(() => {
    void step;
    if (firstRender) { firstRender = false; return; }
    heading?.focus();
  });

  function chooseLang(l: Lang) {
    i18n.lang = l;
    if (!unitTouched) unit = defaultUnit();
    act((ds) => { ds.settings.language = l; ds.settings.unit = unit; });
  }
  function chooseUnit(u: WeightUnit) {
    unit = u;
    unitTouched = true;
    act((ds) => { ds.settings.unit = u; });
  }
  function next() {
    if (!primary) return;
    // NOTE: persist both choices even when the user never touched the controls.
    act((ds) => { ds.settings.language = i18n.lang; ds.settings.unit = unit; ds.settings.pubLanguage = primary; ds.settings.pubLanguages = others.filter((c) => c !== primary); });
    step = isIos ? 2 : 3;
  }
  const finish = () => act((ds) => { ds.settings.firstRunDone = true; });
  function paste() {
    finish();
    app.tab = 'publications';
    app.pasteOpen = true;
  }
  function empty() {
    finish();
    app.tab = 'count';
  }
  async function openFile() {
    error = '';
    const text = await pickTextFile('.pubcount,application/json');
    if (text === null) return;
    try {
      const r = await openPubcountText(text);
      if (r === 'ok') { finish(); app.tab = 'count'; } else error = t(`first.err.${r}`);
    } catch (e) {
      error = t(e === 'backupFailed' ? 'first.err.backupFailed' : 'first.err.invalid');
    }
  }
</script>

<main class="first">
  <h1><Icon name="scale" size={28} /> {t('first.title')}</h1>

  {#if step === 1}
    <fieldset class="segset">
      <legend>{t('first.language')}</legend>
      <div class="seg">
        {#each langs as l (l.code)}
          <label><input type="radio" name="lang" checked={i18n.lang === l.code} onchange={() => chooseLang(l.code)} /><span>{l.name}</span></label>
        {/each}
      </div>
    </fieldset>
    <p class="muted">{t('form.required')}</p>
    <LanguagePicker mode="single" required legend={t('first.pubLanguage')} value={primary}
      onchange={(c) => { primary = c; primaryTouched = true; }} />
    <LanguagePicker mode="multi" legend={t('first.pubLanguages')} value={others} onchange={(v) => (others = v)} />
    <fieldset class="segset">
      <legend>{t('first.unit')} <span aria-hidden="true">*</span></legend>
      <div class="seg">
        {#each units as u (u)}
          <label><input type="radio" name="unit" checked={unit === u} onchange={() => chooseUnit(u)} /><span>{u}</span></label>
        {/each}
      </div>
    </fieldset>
    {#if !primary && languagesLoaded()}<p class="err" role="alert">{t('first.pubLanguage.required')}</p>{/if}
    <button type="button" class="primary big" disabled={!primary} onclick={next}>{t('first.next')} <Icon name="chevron" /></button>
  {:else if step === 2}
    <h2 tabindex="-1" bind:this={heading}>{t('first.ios.title')}</h2>
    <p>{t('first.ios.steps')}</p>
    <p>{t('first.ios.why')}</p>
    <button type="button" class="primary big" onclick={() => (step = 3)}>{t('first.ios.continue')} <Icon name="chevron" /></button>
  {:else}
    <h2 tabindex="-1" bind:this={heading}>{t('first.start.title')}</h2>
    <div class="col">
      <button type="button" class="primary big" onclick={paste}><Icon name="clipboard" size={24} /> {t('first.paste')}</button>
      <button type="button" class="big" onclick={openFile}><Icon name="folder" size={24} /> {t('first.open')}</button>
      <button type="button" class="big" onclick={empty}><Icon name="pencil" size={24} /> {t('first.empty')}</button>
    </div>
    <p class="err" role="alert">{error}</p>
  {/if}
</main>

<style>
  .first { max-width: 480px; margin: 0 auto; padding: var(--sp-6) var(--sp-4); display: grid; gap: var(--sp-4); }
  h1 { display: flex; align-items: center; gap: var(--sp-2); color: var(--accent); }
  .col { display: grid; gap: var(--sp-3); }
</style>
