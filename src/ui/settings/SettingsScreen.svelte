<script lang="ts">
  import { act, app } from '../../store/app.svelte';
  import { fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { pubLanguageOf } from '../../domain/dataset';
    import { clean } from '../../domain/text';
  import { fromGrams } from '../../domain/units';
  import type { Dataset, Lang, ScaleRange, Theme, WeightUnit } from '../../domain/types';
  import { applyTheme } from '../theme';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import LanguagePicker from '../shared/LanguagePicker.svelte';
  import ScaleEditor from './ScaleEditor.svelte';
  import HowItWorks from './HowItWorks.svelte';
  import CloudSection from './CloudSection.svelte';
  import DataSection from './DataSection.svelte';
  import Icon from '../shared/Icon.svelte';

  const themes: Theme[] = ['system', 'light', 'dark'];
  const langs: { code: Lang; name: string }[] = [
    { code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  ];
  const units: WeightUnit[] = ['g', 'kg', 'lb', 'oz'];

  let view = $state<'main' | 'how'>('main');
  let editingScale = $state(false);
  let confirm = $state<'clearScale' | null>(null);

  const settings = $derived(app.ds.settings);
  const num = (g: number) => fmtNumber(fromGrams(g, settings.unit), 3);

  // NOTE: old datasets lack pubLanguage; the displayed default is persisted with the first settings save.
  const save = (fn: (ds: Dataset) => void) => act((ds) => { ds.settings.pubLanguage ||= pubLanguageOf(ds.settings, i18n.lang); fn(ds); });
  function chooseTheme(th: Theme) { save((ds) => { ds.settings.theme = th; }); applyTheme(th); }
  function chooseLang(l: Lang) { save((ds) => { ds.settings.language = l; }); i18n.lang = l; }
  function choosePrimary(c: string) {
    save((ds) => { ds.settings.pubLanguage = c; ds.settings.pubLanguages = (ds.settings.pubLanguages ?? []).filter((x) => x !== c); });
  }
  function chooseOthers(v: string[]) { save((ds) => { ds.settings.pubLanguages = v; }); }
  function chooseUnit(u: WeightUnit) { save((ds) => { ds.settings.unit = u; }); }
  function saveLocation(e: Event) {
    const v = clean((e.currentTarget as HTMLInputElement).value);
    save((ds) => { ds.settings.locationName = v || undefined; });
  }
  function saveScale(scale: ScaleRange[]) { save((ds) => { ds.settings.scale = scale; }); editingScale = false; }
  function clearScale() { confirm = null; save((ds) => { ds.settings.scale = null; }); }

</script>

<div class="col">
  {#if view === 'how'}
    <HowItWorks onback={() => (view = 'main')} />
  {:else}
    <section class="card stack">
      <h2 class="sec">{t('set.appearance')}</h2>
      <fieldset class="segset">
        <legend>{t('set.theme')}</legend>
        <div class="seg">
          {#each themes as th (th)}
            <label><input type="radio" name="theme" checked={settings.theme === th} onchange={() => chooseTheme(th)} /><span>{t(`set.theme.${th}`)}</span></label>
          {/each}
        </div>
      </fieldset>
      <fieldset class="segset">
        <legend>{t('set.language')}</legend>
        <div class="seg">
          {#each langs as l (l.code)}
            <label><input type="radio" name="lang" checked={i18n.lang === l.code} onchange={() => chooseLang(l.code)} /><span>{l.name}</span></label>
          {/each}
        </div>
      </fieldset>
    </section>

    <section class="card stack">
      <h2 class="sec">{t('set.weighing')}</h2>
      <p class="muted">{t('form.required')}</p>
      <fieldset class="segset">
        <legend>{t('set.unit')} <span aria-hidden="true">*</span></legend>
        <div class="seg">
          {#each units as u (u)}
            <label><input type="radio" name="unit" checked={settings.unit === u} onchange={() => chooseUnit(u)} /><span>{u}</span></label>
          {/each}
        </div>
      </fieldset>
      <h3>{t('set.scale')}</h3>
      {#if editingScale}
        <ScaleEditor scale={settings.scale ?? []} onsave={saveScale} oncancel={() => (editingScale = false)} />
      {:else}
        {#if settings.scale?.length}
          <ul>
            {#each settings.scale as r (r.upToG)}
              <li>{t('set.scaleRow', { upTo: num(r.upToG), res: num(r.resolutionG), unit: settings.unit })}</li>
            {/each}
          </ul>
        {:else}
          <p class="muted">{t('set.scaleNone')}</p>
        {/if}
        <div class="btn-row">
          <button type="button" onclick={() => (editingScale = true)}><Icon name="pencil" /> {t('set.scaleEdit')}</button>
          {#if settings.scale}<button type="button" onclick={() => (confirm = 'clearScale')}>{t('set.scaleClear')}</button>{/if}
        </div>
      {/if}
      <label class="field">{t('set.location')}
        <input type="text" maxlength="200" value={settings.locationName ?? ''} onchange={saveLocation} />
      </label>
    </section>

    <section class="card stack">
      <h2 class="sec">{t('set.pubLangs')}</h2>
      <p class="muted">{t('form.required')}</p>
      <LanguagePicker mode="single" required legend={t('set.pubLanguage')} value={pubLanguageOf(settings, i18n.lang)} onchange={choosePrimary} />
      <LanguagePicker mode="multi" legend={t('set.pubLanguages')} value={(settings.pubLanguages ?? []).filter((c) => c !== pubLanguageOf(settings, i18n.lang))} onchange={chooseOthers} />
    </section>

    <section class="card stack">
      <h2 class="sec">{t('set.cloud')}</h2>
      <CloudSection />
    </section>

    <DataSection />

    <div class="btn-row">
      <button type="button" onclick={() => (view = 'how')}><Icon name="info" /> {t('set.howLink')}</button>
      <a class="btn" href="/privacy.html" target="_blank" rel="noopener">{t('set.privacyLink')}</a>
    </div>
  {/if}
</div>

<ConfirmDialog open={confirm === 'clearScale'} title={t('set.scaleClearTitle')} message={t('set.scaleClearMessage')}
  confirmLabel={t('set.scaleClearConfirm')} danger onconfirm={clearScale} oncancel={() => (confirm = null)} />
<style>
  .col { max-width: 560px; margin: 0 auto; display: grid; gap: var(--sp-4); }
  .btn-row > * { flex: 1 1 auto; }
</style>
