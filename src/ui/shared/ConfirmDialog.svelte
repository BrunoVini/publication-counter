<script lang="ts">
  import { t } from '../../i18n/index.svelte';

  let { open, title, message, confirmLabel, danger = false, requireText, onconfirm, oncancel }: {
    open: boolean; title: string; message: string; confirmLabel: string;
    danger?: boolean; requireText?: string; onconfirm: () => void; oncancel: () => void;
  } = $props();

  let dlg: HTMLDialogElement;
  let typed = $state('');
  // NOTE: trimmed and case-insensitive, so a phone keyboard's auto-capitalisation or a stray space does not block.
  const ok = $derived(!requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase());
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
      <label class="type">{t('dialog.typeToConfirm', { word: requireText })}
        <input type="text" bind:value={typed} autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
    {/if}
    <div class="actions">
      <button type="button" onclick={oncancel}>{t('dialog.cancel')}</button>
      <button type="button" class:danger disabled={!ok} onclick={onconfirm}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  dialog { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; max-width: 380px; padding: 0; }
  .content { padding: 16px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .type { display: grid; gap: 4px; margin: 8px 0; }
  input { min-height: 44px; font-size: 1rem; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); }
  button:disabled { opacity: 0.5; }
  .danger { background: var(--bad); color: var(--bg); border-color: var(--bad); font-weight: 700; }
</style>
