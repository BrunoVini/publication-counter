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
  import Icon from './Icon.svelte';
</script>

<div class="toast-host no-print" aria-live="polite">
  {#if current}
    <div class="toast">
      <span>{current.message}</span>
      {#if current.action}
        {@const action = current.action}
        <button type="button" class="act" onclick={() => { action.run(); current = null; }}>{action.label}</button>
      {/if}
      <button type="button" aria-label={t('toast.dismiss')} onclick={() => (current = null)}><Icon name="close" /></button>
    </div>
  {/if}
</div>

<style>
  /* NOTE: on phones the toast floats above the sticky action button instead of covering it. */
  .toast-host { position: fixed; inset-inline: 0; bottom: calc(var(--nav-h) + var(--tap-lg) + var(--sp-6)); display: flex; justify-content: center; padding: 0 var(--sp-4); pointer-events: none; z-index: 20; }
  .toast { pointer-events: auto; display: flex; align-items: center; gap: var(--sp-1); max-width: 480px; background: var(--text); color: var(--bg); border-radius: var(--radius); padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-4); }
  .toast button { background: none; border: 0; color: inherit; font-weight: 700; padding: 0 var(--sp-3); }
  .toast .act { text-decoration: underline; }
  @media (min-width: 900px) { .toast-host { bottom: var(--sp-4); } }
</style>
