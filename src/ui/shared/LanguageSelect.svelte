<script lang="ts">
  import { act, app } from '../../store/app.svelte';
  import { i18n, t } from '../../i18n/index.svelte';
  import { languageName } from '../../domain/languages.svelte';
  import LanguagePicker from './LanguagePicker.svelte';

  let { value = $bindable(), label, id }: { value: string; label: string; id?: string } = $props();

  const OTHER = '\u0000other';
  const primary = $derived(app.ds.settings.pubLanguage);
  const secondary = $derived(app.ds.settings.pubLanguages ?? []);
  // NOTE: the current value is always an option, so legacy free text shows as selected with its raw label.
  const codes = $derived([...new Set([primary, ...secondary, value].filter((c): c is string => !!c))]);

  let dlg: HTMLDialogElement;
  let choice = $state('');
  let remember = $state(false);
  let opened = $state(false);
  let select: HTMLSelectElement;

  function onselect(e: Event & { currentTarget: HTMLSelectElement }) {
    if (e.currentTarget.value !== OTHER) { value = e.currentTarget.value; return; }
    // Put the visible choice back until a language is picked.
    e.currentTarget.value = value;
    choice = ''; remember = false;
    opened = true;
    dlg.showModal();
  }
  function use() {
    if (!choice) return;
    value = choice;
    if (remember && choice !== primary && !secondary.includes(choice)) {
      act((ds) => { ds.settings.pubLanguages = [...(ds.settings.pubLanguages ?? []), choice]; });
    }
    dlg.close();
  }
  // NOTE: Svelte does not re-sync a select whose options change under it, so mirror the value.
  $effect(() => { void codes; if (select) select.value = value; });
</script>

<select {id} aria-label={label} bind:this={select} {value} onchange={onselect}>
  {#if !value}<option value="" selected>—</option>{/if}
  {#each codes as c (c)}<option value={c} selected={c === value}>{languageName(c, i18n.lang)}</option>{/each}
  <option value={OTHER}>{t('lang.other')}</option>
</select>

<dialog bind:this={dlg} aria-label={t('lang.otherTitle')} onclose={() => (opened = false)} oncancel={(e) => { e.preventDefault(); dlg.close(); }}>
  <!-- NOTE: the dialog sits inside the publication form, so Enter in the search box must not submit it. -->
  <div class="content" role="presentation" onkeydown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}>
    {#if opened}<LanguagePicker mode="single" legend={t('lang.otherTitle')} value={choice} onchange={(v) => (choice = v)} />{/if}
    <label class="opt"><input type="checkbox" bind:checked={remember} /> {t('lang.addToMine')}</label>
    <div class="actions">
      <button type="button" onclick={() => dlg.close()}>{t('dialog.cancel')}</button>
      <button type="button" class="primary" disabled={!choice} onclick={use}>{t('lang.use')}</button>
    </div>
  </div>
</dialog>

<style>
  select { min-height: 44px; font-size: 16px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
  dialog { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: min(520px, 94vw); padding: 0; }
  .content { padding: 16px; display: grid; gap: 12px; }
  .opt { display: flex; align-items: center; gap: 8px; min-height: 44px; }
  .opt input { width: 24px; height: 24px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { min-height: 44px; padding: 0 16px; font-size: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); }
  button:disabled { opacity: 0.5; }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
</style>
