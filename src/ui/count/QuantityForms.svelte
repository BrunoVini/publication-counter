<script lang="ts">
  import { act } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';
  import { addEntry, updatePublication } from '../../domain/dataset';
  import type { Entry } from '../../domain/types';
  import { parseWhole } from './errors';

  // NOTE: the texts and the error are owned by the parent so they survive switching tabs.
  let {
    tab, countId, pubId, packSize, run, announce,
    packsText = $bindable(), perPackText = $bindable(), handText = $bindable(), formError = $bindable(),
  }: {
    tab: 'sealed' | 'hand'; countId: string; pubId: string; packSize: number | undefined;
    run: (fn: () => void) => boolean; announce: (e: Entry, units: number) => void;
    packsText: string; perPackText: string; handText: string; formError: string;
  } = $props();

  const uid = () => crypto.randomUUID();
  let packsInput: HTMLInputElement | undefined = $state();
  let handInput: HTMLInputElement | undefined = $state();

  function addSealed(): void {
    const packs = parseWhole(packsText);
    const perPack = parseWhole(perPackText);
    if (packs === null || perPack === null) { formError = t('sealed.invalid'); return; }
    formError = '';
    let entry: Entry | undefined;
    const ok = run(() => {
      entry = act((ds) => {
        const e = addEntry(ds, countId, pubId, { kind: 'sealed', packs, perPack }, uid);
        if (packSize !== perPack) updatePublication(ds, pubId, { packSize: perPack });
        return e;
      });
    });
    if (!ok) return;
    announce(entry!, packs * perPack);
    packsText = '';
    packsInput?.focus();
  }
  function addHand(): void {
    const units = parseWhole(handText);
    if (units === null) { formError = t('hand.invalid'); return; }
    formError = '';
    let entry: Entry | undefined;
    if (!run(() => { entry = act((ds) => addEntry(ds, countId, pubId, { kind: 'hand', units }, uid)); })) return;
    announce(entry!, units);
    handText = '';
    handInput?.focus();
  }

</script>

{#if tab === 'sealed'}
  <form class="grid" onsubmit={(e) => { e.preventDefault(); addSealed(); }}>
    <label class="field">{t('sealed.packs')}<input bind:this={packsInput} type="text" inputmode="numeric" bind:value={packsText} /></label>
    <label class="field">{t('sealed.perPack')}<input type="text" inputmode="numeric" bind:value={perPackText} /></label>
    {#if formError}<p class="bad" role="alert">{formError}</p>{/if}
    <button type="submit" class="primary big">{t('weight.add')}</button>
  </form>
{:else}
  <form class="grid" onsubmit={(e) => { e.preventDefault(); addHand(); }}>
    <label class="field">{t('hand.units')}<input bind:this={handInput} type="text" inputmode="numeric" bind:value={handText} /></label>
    {#if formError}<p class="bad" role="alert">{formError}</p>{/if}
    <button type="submit" class="primary big">{t('weight.add')}</button>
  </form>
{/if}

<style>
  .grid { display: grid; gap: var(--sp-2); }
</style>
