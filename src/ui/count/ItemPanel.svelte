<script lang="ts">
  import { app } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';

  let { countId, pubId }: { countId: string; pubId: string } = $props();
  const pub = $derived(app.ds.publications.find((p) => p.id === pubId));
</script>

<!-- NOTE: stub; the entry panel replaces this. countId is unused until then. -->
<section class="panel" data-count={countId}>
  <h2>{pub?.name}</h2>
  <button type="button" onclick={() => (app.openItemId = null)}>{t('item.close')}</button>
</section>

<style>
  .panel { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
  button { min-height: 44px; padding: 0 16px; }
</style>
