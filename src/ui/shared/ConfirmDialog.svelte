<script lang="ts">
  import { intlLocale, t } from '../../i18n/index.svelte';

  const { open, title, message, confirmLabel, danger = false, requireText, onconfirm, oncancel }: {
    open: boolean; title: string; message: string; confirmLabel: string;
    danger?: boolean; requireText?: string; onconfirm: () => void; oncancel: () => void;
  } = $props();

  let dlg: HTMLDialogElement;
  let typed = $state('');
  // NOTE: trimmed, case-insensitive in the UI locale (Turkish "SİL" vs "sil") and accent-insensitive, so a phone
  // keyboard's auto-capitalisation, a stray space or a missing accent does not block.
  const fold = (s: string) => s.trim().toLocaleLowerCase(intlLocale()).normalize('NFD').replace(/\p{M}/gu, '');
  const ok = $derived(!requireText || fold(typed) === fold(requireText));
  $effect(() => {
    if (open && !dlg.open) { typed = ''; dlg.showModal(); }
    else if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} aria-labelledby="cd-title" oncancel={(e) => { e.preventDefault(); oncancel(); }}
  onclick={(e) => { if (e.target === dlg) oncancel(); }}>
  <!-- NOTE: the dialog's own padding is the backdrop hit area; content lives in the inner div. -->
  <div class="content">
    <h2 id="cd-title">{title}</h2>
    <p>{message}</p>
    {#if requireText}
      <label class="field">{t('dialog.typeToConfirm', { word: requireText })}
        <input type="text" bind:value={typed} autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
    {/if}
    <div class="actions">
      <button type="button" onclick={oncancel}>{t('dialog.cancel')}</button>
      <button type="button" class={danger ? 'danger solid' : 'primary'} disabled={!ok} onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  .actions { margin-top: var(--sp-1); }
</style>
