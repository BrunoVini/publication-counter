<script lang="ts">
  import { onMount } from 'svelte';
  import { act, app, replaceDataset } from '../../store/app.svelte';
  import { getCorrupt, listBackups, type Backup } from '../../store/persist';
  import { fmtDate, fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { exportFileName, parseDataset, serializeDataset } from '../../domain/file';
  import { localDate } from '../../domain/text';
  import { fromGrams } from '../../domain/units';
  import type { Dataset, Lang, ScaleRange, Theme, WeightUnit } from '../../domain/types';
  import { applyTheme } from '../theme';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { openPubcountText, pickTextFile, shareOrDownload } from '../shared/fileio';
  import ScaleEditor from './ScaleEditor.svelte';
  import HowItWorks from './HowItWorks.svelte';

  const themes: Theme[] = ['system', 'light', 'dark'];
  const langs: { code: Lang; name: string }[] = [
    { code: 'pt', name: 'Português' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
  ];
  const units: WeightUnit[] = ['g', 'kg', 'lb', 'oz'];

  let view = $state<'main' | 'how' | 'privacy'>('main');
  let editingScale = $state(false);
  let confirm = $state<'clearScale' | 'open' | null>(null);
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

  function chooseTheme(th: Theme) { act((ds) => { ds.settings.theme = th; }); applyTheme(th); }
  function chooseLang(l: Lang) { i18n.lang = l; act((ds) => { ds.settings.language = l; }); }
  function chooseUnit(u: WeightUnit) { act((ds) => { ds.settings.unit = u; }); }
  function saveLocation(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value.trim();
    act((ds) => { ds.settings.locationName = v || undefined; });
  }
  function saveScale(scale: ScaleRange[]) { act((ds) => { ds.settings.scale = scale; }); editingScale = false; }
  function clearScale() { confirm = null; act((ds) => { ds.settings.scale = null; }); }

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
  {:else if view === 'privacy'}
    <section class="stack">
      <button type="button" onclick={() => (view = 'main')}>{t('set.back')}</button>
      <h2>{t('set.privacyTitle')}</h2>
      <p>{t('set.privacyText')}</p>
    </section>
  {:else}
    <section class="stack">
      <h2>{t('set.appearance')}</h2>
      <fieldset>
        <legend>{t('set.theme')}</legend>
        {#each themes as th (th)}
          <label><input type="radio" name="theme" checked={settings.theme === th} onchange={() => chooseTheme(th)} /> {t(`set.theme.${th}`)}</label>
        {/each}
      </fieldset>
      <fieldset>
        <legend>{t('set.language')}</legend>
        {#each langs as l (l.code)}
          <label><input type="radio" name="lang" checked={i18n.lang === l.code} onchange={() => chooseLang(l.code)} /> {l.name}</label>
        {/each}
      </fieldset>
    </section>

    <section class="stack">
      <h2>{t('set.weighing')}</h2>
      <fieldset>
        <legend>{t('set.unit')}</legend>
        {#each units as u (u)}
          <label><input type="radio" name="unit" checked={settings.unit === u} onchange={() => chooseUnit(u)} /> {u}</label>
        {/each}
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
        <div class="row">
          <button type="button" onclick={() => (editingScale = true)}>{t('set.scaleEdit')}</button>
          {#if settings.scale}<button type="button" onclick={() => (confirm = 'clearScale')}>{t('set.scaleClear')}</button>{/if}
        </div>
      {/if}
      <label class="field">{t('set.location')}
        <input type="text" value={settings.locationName ?? ''} onchange={saveLocation} />
      </label>
    </section>

    <section class="stack">
      <h2>{t('set.cloud')}</h2>
      <button type="button" disabled>{t('set.cloudSoon')}</button>
    </section>

    <section class="stack">
      <h2>{t('set.data')}</h2>
      <div class="row">
        <button type="button" onclick={handover}>{t('set.handover')}</button>
        <button type="button" onclick={openFile}>{t('set.open')}</button>
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
              <button type="button" onclick={() => (restoring = b)}>{t('set.restoreBtn')}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <div class="row">
      <button type="button" onclick={() => (view = 'how')}>{t('set.howLink')}</button>
      <button type="button" onclick={() => (view = 'privacy')}>{t('set.privacyLink')}</button>
    </div>
  {/if}
</div>

<ConfirmDialog open={confirm === 'clearScale'} title={t('set.scaleClearTitle')} message={t('set.scaleClearMessage')}
  confirmLabel={t('set.scaleClearConfirm')} danger onconfirm={clearScale} oncancel={() => (confirm = null)} />
<ConfirmDialog open={confirm === 'open'} title={t('set.openTitle')} message={t('set.openMessage')}
  confirmLabel={t('set.openConfirm')} danger onconfirm={confirmOpen} oncancel={() => (confirm = null)} />
<ConfirmDialog open={restoring !== null} title={t('set.restoreTitle')} message={t('set.restoreMessage')}
  confirmLabel={t('set.restoreConfirm')} danger onconfirm={restore} oncancel={() => (restoring = null)} />

<style>
  .col { max-width: 560px; margin: 0 auto; display: grid; gap: 24px; }
  .stack { display: grid; gap: 8px; }
  h2, h3, p, ul { margin: 0; }
  fieldset { border: 1px solid var(--border); border-radius: 10px; display: flex; flex-wrap: wrap; gap: 4px 16px; }
  label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
  .field { display: grid; gap: 2px; }
  input[type='text'] { min-height: 44px; font-size: 1rem; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
  input[type='radio'] { width: 24px; height: 24px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  button { min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 16px; }
  button:disabled { color: var(--muted); }
  button:first-child:not(.row button) { justify-self: start; }
  .backups { list-style: none; padding: 0; display: grid; gap: 8px; }
  .backups li { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .muted { color: var(--muted); }
  .bad { color: var(--bad); }
</style>
