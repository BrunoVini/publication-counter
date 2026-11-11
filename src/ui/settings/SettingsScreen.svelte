<script lang="ts">
  import { onMount } from 'svelte';
  import { act, app, replaceDataset, wipeDevice } from '../../store/app.svelte';
  import { getCorrupt, listBackups, type Backup } from '../../store/persist';
  import { fmtDate, fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { pubLanguageOf } from '../../domain/dataset';
  import { exportFileName, parseDataset, serializeDataset } from '../../domain/file';
  import { clean, localDate } from '../../domain/text';
  import { fromGrams } from '../../domain/units';
  import type { Dataset, Lang, ScaleRange, Theme, WeightUnit } from '../../domain/types';
  import { applyTheme } from '../theme';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { openPubcountText, pickTextFile, shareOrDownload } from '../shared/fileio';
  import LanguagePicker from '../shared/LanguagePicker.svelte';
  import ScaleEditor from './ScaleEditor.svelte';
  import HowItWorks from './HowItWorks.svelte';
  import CloudSection from './CloudSection.svelte';
  import Icon from '../shared/Icon.svelte';

  const themes: Theme[] = ['system', 'light', 'dark'];
  const langs: { code: Lang; name: string }[] = [
    { code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  ];
  const units: WeightUnit[] = ['g', 'kg', 'lb', 'oz'];

  let view = $state<'main' | 'how'>('main');
  let editingScale = $state(false);
  let confirm = $state<'clearScale' | 'open' | 'wipe' | 'wipeType' | null>(null);
  let restoring = $state<Backup | null>(null);
  let pendingText = '';
  let error = $state('');
  let backups = $state<Backup[]>([]);
  let corrupt = $state<unknown>(undefined);

  const settings = $derived(app.ds.settings);
  const num = (g: number) => fmtNumber(fromGrams(g, settings.unit), 3);
  const when = (iso: string) => `${fmtDate(iso)} ${new Date(iso).toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' })}`;
  const reason = (r: string) => { const k = `set.reason.${r}`; const m = t(k); return m === k ? r : m; };
  const refresh = async () => { backups = await listBackups(); corrupt = await getCorrupt(); };
  onMount(refresh);

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

  async function handover() {
    try {
      await shareOrDownload(exportFileName(app.ds, localDate()), serializeDataset($state.snapshot(app.ds) as Dataset), 'application/json');
    } catch { showToast(t('set.handoverErr')); }
  }
  async function exportCorrupt() {
    try {
      await shareOrDownload(`pubcount-unreadable-${localDate()}.json`, JSON.stringify(corrupt, null, 2), 'application/json');
    } catch { showToast(t('set.handoverErr')); }
  }
  async function replaceWith(run: () => Promise<string>) {
    error = '';
    try {
      const r = await run();
      if (r === 'ok') showToast(t('set.openDone'));
      else error = t(`set.err.${r}`);
    } catch (e) {
      error = t(e === 'backupFailed' ? 'set.err.backupFailed' : 'set.err.invalid');
    }
    await refresh();
  }
  async function openFile() {
    error = '';
    const text = await pickTextFile('.pubcount,application/json');
    if (text === null) return;
    // NOTE: parse first so an unusable file shows its error instead of a pointless confirmation.
    const parsed = parseDataset(text);
    if (!parsed.ok) { error = t(`set.err.${parsed.error}`); return; }
    if (app.ds.publications.length > 0) { pendingText = text; confirm = 'open'; } else await replaceWith(() => openPubcountText(text));
  }
  function confirmOpen() { confirm = null; return replaceWith(() => openPubcountText(pendingText)); }
  async function confirmWipe() {
    confirm = null;
    error = '';
    try { await wipeDevice(); } catch { error = t('set.wipeErr'); }
  }
  async function restore() {
    const b = restoring;
    restoring = null;
    if (!b) return;
    error = '';
    try {
      await replaceDataset(b.dataset, 'restore backup');
      showToast(t('set.restoreDone'));
    } catch (e) {
      error = t(e === 'backupFailed' ? 'set.err.backupFailed' : 'set.err.invalid');
    }
    await refresh();
  }
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

    <section class="card stack">
      <h2 class="sec">{t('set.data')}</h2>
      <div class="btn-row">
        <button type="button" onclick={handover}><Icon name="share" /> {t('set.handover')}</button>
        <button type="button" onclick={openFile}><Icon name="folder" /> {t('set.open')}</button>
      </div>
      {#if corrupt !== undefined}
        <button type="button" onclick={exportCorrupt}>{t('set.exportCorrupt')}</button>
      {/if}
      {#if error}<p class="bad" role="alert">{error}</p>{/if}
      <h3>{t('set.restore')}</h3>
      {#if backups.length === 0}
        <p class="muted">{t('set.noBackups')}</p>
      {:else}
        <ul class="backups">
          {#each backups as b (b.savedAt)}
            <li>
              <span>{t('set.backupInfo', { when: when(b.savedAt), reason: reason(b.reason), count: b.dataset.publications.length })}</span>
              <button type="button" onclick={() => (restoring = b)}><Icon name="undo" /> {t('set.restoreBtn')}</button>
            </li>
          {/each}
        </ul>
      {/if}
      <h3>{t('set.wipe')}</h3>
      <button type="button" class="danger" onclick={() => (confirm = 'wipe')}><Icon name="trash" /> {t('set.wipe')}</button>
    </section>

    <div class="btn-row">
      <button type="button" onclick={() => (view = 'how')}><Icon name="info" /> {t('set.howLink')}</button>
      <a class="btn" href="/privacy.html" target="_blank" rel="noopener">{t('set.privacyLink')}</a>
    </div>
  {/if}
</div>

<ConfirmDialog open={confirm === 'clearScale'} title={t('set.scaleClearTitle')} message={t('set.scaleClearMessage')}
  confirmLabel={t('set.scaleClearConfirm')} danger onconfirm={clearScale} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'open'} title={t('set.openTitle')} message={t('set.openMessage')}
  confirmLabel={t('set.openConfirm')} danger onconfirm={confirmOpen} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'wipe'} title={t('set.wipeTitle')} message={t('set.wipeMessage')}
  confirmLabel={t('set.wipeNext')} danger onconfirm={() => (confirm = 'wipeType')} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'wipeType'} title={t('set.wipeTitle2')} message={t('set.wipeMessage2')}
  confirmLabel={t('set.wipeConfirm')} requireText={t('set.wipeWord')} danger onconfirm={confirmWipe} oncancel={() => (confirm = null)} />
<ConfirmDialog open={restoring !== null} title={t('set.restoreTitle')} message={t('set.restoreMessage')}
  confirmLabel={t('set.restoreConfirm')} danger onconfirm={restore} oncancel={() => (restoring = null)} />

<style>
  .col { max-width: 560px; margin: 0 auto; display: grid; gap: var(--sp-4); }
  .card > button { justify-self: start; }
  .btn-row > * { flex: 1 1 auto; }
  .backups { list-style: none; padding: 0; display: grid; gap: var(--sp-2); }
  .backups li { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); }
</style>
