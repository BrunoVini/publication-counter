<script lang="ts">
  import { i18n } from '../../i18n/index.svelte';
  import { NATIVE_NAMES } from '../../i18n/names';
  import { LANGS, type Lang } from '../../domain/types';

  const { legend, onchoose }: { legend: string; onchoose: (l: Lang) => void } = $props();
</script>

<label class="field">
  <span>{legend}</span>
  <select value={i18n.lang} onchange={(e) => onchoose(e.currentTarget.value as Lang)}>
    {#each LANGS as code (code)}
      <option value={code} lang={code}>{NATIVE_NAMES[code]}</option>
    {/each}
  </select>
</label>
