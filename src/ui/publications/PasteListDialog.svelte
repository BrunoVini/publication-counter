<script lang="ts">
  import { untrack } from 'svelte';
  import { app, act } from '../../store/app.svelte';
  import { i18n, t } from '../../i18n/index.svelte';
  import { addPublication, pubLanguageOf } from '../../domain/dataset';
  import { parsePastedList } from '../../domain/text';
  import { canonicalKey, languageByName, languageName, loadLanguages } from '../../domain/languages.svelte';
  import LanguageSelect from '../shared/LanguageSelect.svelte';
  import { showToast } from '../shared/Toast.svelte';
  import { errorMessage } from '../count/errors';
  import Icon from '../shared/Icon.svelte';

  const { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let dlg: HTMLDialogElement;
  let text = $state('');
  let language = $state('');
  let error = $state('');
  void loadLanguages();

  $effect(() => {
    if (open && !dlg.open) {
      untrack(() => { text = ''; error = ''; language = pubLanguageOf(app.ds.settings, i18n.lang); });
      dlg.showModal();
    } else if (!open && dlg.open) dlg.close();
  });

  type Status = 'new' | 'paste' | 'catalogue';
  const rows = $derived.by(() => {
    // NOTE: archived publications are ignored, matching the domain's uniqueness rule.
    const known = new Set(app.ds.publications.filter((p) => !p.archived).map(canonicalKey));
    const seen = new Set<string>();
    return parsePastedList(text, language.trim(), languageByName).map((r) => {
      const key = canonicalKey(r);
      const status: Status = known.has(key) ? 'catalogue' : seen.has(key) ? 'paste' : 'new';
      seen.add(key);
      return { ...r, status };
    });
  });
  const fresh = $derived(rows.filter((r) => r.status === 'new'));
  const label = { new: 'pubs.paste.new', paste: 'pubs.paste.dupPaste', catalogue: 'pubs.paste.dupCatalogue' } as const;
  const icon = { new: 'plus', paste: 'minus', catalogue: 'minus' } as const;

  function confirm() {
    // NOTE: snapshot first; `fresh` recomputes to empty once the rows are in the catalogue.
    const added = [...fresh];
    try {
      act((ds) => {
        for (const r of added) {
          addPublication(ds, { name: r.name, language: r.language, variant: r.variant, defaultMode: 'weigh' }, () => crypto.randomUUID());
        }
      });
      showToast(t('pubs.paste.added', { count: added.length }));
      onclose();
    } catch (e) {
      error = errorMessage(e);
    }
  }
</script>

<dialog bind:this={dlg} aria-labelledby="pl-title" oncancel={(e) => { e.preventDefault(); onclose(); }}>
  <div class="content">
    <h2 id="pl-title">{t('pubs.paste')}</h2>
    <p class="muted">{t('pubs.paste.help')}</p>
    <p class="muted">{t('form.required')}</p>
    <label class="field">
      <span>{t('pubs.paste.list')} <span aria-hidden="true">*</span></span>
      <textarea rows="6" aria-required="true" bind:value={text} autocomplete="off"></textarea>
    </label>
    <div class="field">
      <span>{t('pubs.paste.language')}</span>
      <LanguageSelect label={t('pubs.paste.language')} bind:value={language} />
    </div>
    {#if rows.length}
      <div class="scroll"><table>
        <thead><tr><th>{t('pubs.name')}</th><th>{t('pubs.language')}</th><th>{t('pubs.variant')}</th><th>{t('pubs.paste.status')}</th></tr></thead>
        <tbody>
          {#each rows as r, i (i)}
            <tr class={r.status}>
              <td>{r.name}</td><td>{languageName(r.language)}</td><td>{r.variant}</td>
              <td><Icon name={icon[r.status]} size={16} /> <span>{t(label[r.status])}</span></td>
            </tr>
          {/each}
        </tbody>
      </table></div>
    {/if}
    {#if error}<p role="alert" class="err">{error}</p>{/if}
    <div class="actions">
      <button type="button" onclick={onclose}>{t('dialog.cancel')}</button>
      <button type="button" class="primary" disabled={fresh.length === 0} onclick={confirm}>{t('pubs.paste.add', { count: fresh.length })}</button>
    </div>
  </div>
</dialog>

<style>
  dialog { width: min(640px, calc(100vw - 2 * var(--sp-4))); }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: start; padding: var(--sp-2); border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: var(--fs-sm); }
  tr.new td:last-child { color: var(--accent); font-weight: 600; }
  tr.paste td, tr.catalogue td { color: var(--muted); }
</style>
