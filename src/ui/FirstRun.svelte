<script lang="ts">
  import { act, app } from '../store/app.svelte';
  import { i18n, t } from '../i18n/index.svelte';
  import type { Lang, WeightUnit } from '../domain/types';
  import { openPubcountText, pickTextFile } from './shared/fileio';

  const langs: { code: Lang; name: string }[] = [
    { code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  ];
  const units: WeightUnit[] = ['g', 'kg', 'lb', 'oz'];

  // NOTE: simple heuristic: pounds only for US English devices, kilograms everywhere else.
  const defaultUnit = (): WeightUnit =>
    i18n.lang === 'en' && /-US$/i.test(navigator.language ?? '') ? 'lb' : 'kg';

  const ua = navigator.userAgent;
  const isIos = (/iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    && (navigator as any).standalone !== true;

  let step = $state<1 | 2 | 3>(1);
  let unit = $state<WeightUnit>(defaultUnit());
  let error = $state('');

  function chooseLang(l: Lang) {
    i18n.lang = l;
    unit = defaultUnit();
    act((ds) => { ds.settings.language = l; ds.settings.unit = unit; });
  }
  function chooseUnit(u: WeightUnit) {
    unit = u;
    act((ds) => { ds.settings.unit = u; });
  }
  function next() {
    // NOTE: persist both choices even when the user never touched the controls.
    act((ds) => { ds.settings.language = i18n.lang; ds.settings.unit = unit; });
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
  <h1>{t('first.title')}</h1>

  {#if step === 1}
    <fieldset>
      <legend>{t('first.language')}</legend>
      {#each langs as l (l.code)}
        <label><input type="radio" name="lang" checked={i18n.lang === l.code} onchange={() => chooseLang(l.code)} /> {l.name}</label>
      {/each}
    </fieldset>
    <fieldset>
      <legend>{t('first.unit')}</legend>
      {#each units as u (u)}
        <label><input type="radio" name="unit" checked={unit === u} onchange={() => chooseUnit(u)} /> {u}</label>
      {/each}
    </fieldset>
    <button type="button" class="primary" onclick={next}>{t('first.next')}</button>
  {:else if step === 2}
    <h2>{t('first.ios.title')}</h2>
    <p>{t('first.ios.steps')}</p>
    <p>{t('first.ios.why')}</p>
    <button type="button" class="primary" onclick={() => (step = 3)}>{t('first.ios.continue')}</button>
  {:else}
    <h2>{t('first.start.title')}</h2>
    <div class="col">
      <button type="button" class="primary" onclick={paste}>{t('first.paste')}</button>
      <button type="button" onclick={openFile}>{t('first.open')}</button>
      <button type="button" onclick={empty}>{t('first.empty')}</button>
    </div>
    <p class="err" role="alert">{error}</p>
  {/if}
</main>

<style>
  .first { max-width: 480px; margin: 0 auto; padding: 24px 16px; display: grid; gap: 16px; }
  fieldset { border: 1px solid var(--border); border-radius: 10px; display: grid; gap: 4px; }
  label { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 16px; }
  input[type='radio'] { width: 24px; height: 24px; }
  .col { display: grid; gap: 12px; }
  button { min-height: 44px; font-size: 16px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
  button.primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .err { color: var(--bad); font-weight: 600; margin: 0; }
</style>
