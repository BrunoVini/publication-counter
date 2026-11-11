<script lang="ts">
  import { untrack } from 'svelte';
  import { t } from '../../i18n/index.svelte';

  const { initial, onsubmit, oncancel }: { initial: string; onsubmit: (counter: string) => void; oncancel: () => void } = $props();

  // NOTE: seeded once on open from the last counter's name.
  let name = $state(untrack(() => initial));
  let nameError = $state(false);

  const modal = (dlg: HTMLDialogElement) => { dlg.showModal(); };
  function confirmName(e: SubmitEvent) {
    e.preventDefault();
    const counter = name.trim();
    if (!counter) { nameError = true; return; }
    onsubmit(counter);
  }
</script>

<dialog use:modal aria-labelledby="who-title" oncancel={(e) => { e.preventDefault(); oncancel(); }}>
  <form class="content" onsubmit={confirmName}>
    <h2 id="who-title" class="visually-hidden">{t('count.new')}</h2>
    <p class="muted">{t('form.required')}</p>
    <label class="field">
      <span>{t('count.who')} <span aria-hidden="true">*</span></span>
      <input maxlength="200" aria-required="true" bind:value={name} autocomplete="off" aria-invalid={nameError} aria-describedby={nameError ? 'who-err' : undefined} />
    </label>
    {#if nameError}<p id="who-err" role="alert" class="err">{t('count.who.required')}</p>{/if}
    <div class="actions">
      <button type="button" onclick={oncancel}>{t('dialog.cancel')}</button>
      <button type="submit" class="primary">{t('count.start')}</button>
    </div>
  </form>
</dialog>
