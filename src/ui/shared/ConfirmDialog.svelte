<script lang="ts">
  import { t } from '../../i18n/index.svelte';

  let { open, title, message, confirmLabel, danger = false, onconfirm, oncancel }: {
    open: boolean; title: string; message: string; confirmLabel: string;
    danger?: boolean; onconfirm: () => void; oncancel: () => void;
  } = $props();

  let dlg: HTMLDialogElement;
  $effect(() => {
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  });
</script>

<dialog bind:this={dlg} aria-labelledby="cd-title" oncancel={(e) => { e.preventDefault(); oncancel(); }}>
  <h2 id="cd-title">{title}</h2>
  <p>{message}</p>
  <div class="actions">
    <button type="button" onclick={oncancel}>{t('dialog.cancel')}</button>
    <button type="button" class:danger onclick={onconfirm}>{confirmLabel}</button>
  </div>
</dialog>

<style>
  dialog { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; max-width: 380px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  .danger { background: var(--bad); color: var(--bg); border-color: var(--bad); font-weight: 700; }
</style>
