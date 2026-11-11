<script module lang="ts">
  type ToastAction = { label: string; run: () => void };
  let current = $state<{ message: string; action?: ToastAction } | null>(null);

  /** A new toast replaces the current one; it stays until replaced or dismissed. */
  export function showToast(message: string, action?: ToastAction): void {
    current = { message, action };
  }
</script>

<script lang="ts">
  import { t } from '../../i18n/index.svelte';
</script>

<div class="toast-host no-print" aria-live="polite">
  {#if current}
    <div class="toast">
      <span>{current.message}</span>
      {#if current.action}
        {@const action = current.action}
        <button type="button" onclick={() => { action.run(); current = null; }}>{action.label}</button>
      {/if}
      <button type="button" aria-label={t('toast.dismiss')} onclick={() => (current = null)}>×</button>
    </div>
  {/if}
</div>

<style>
  .toast-host { position: fixed; left: 0; right: 0; bottom: 72px; display: flex; justify-content: center; padding: 0 16px; pointer-events: none; z-index: 20; }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: 8px; background: var(--text); color: var(--bg); border-radius: 10px; padding: 4px 8px 4px 16px; }
  .toast button { background: none; border: 0; color: inherit; font-weight: 700; padding: 0 12px; }
  @media (min-width: 900px) { .toast-host { bottom: 16px; } }
</style>
