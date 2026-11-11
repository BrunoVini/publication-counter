<script lang="ts">
  import { fmtNumber, t } from '../../i18n/index.svelte';

  let { onback }: { onback: () => void } = $props();
</script>

<section class="how">
  <button type="button" onclick={onback}>{t('set.back')}</button>
  <h2>{t('how.title')}</h2>
  <p>{t('how.step1', { w: fmtNumber(489), n: fmtNumber(200), u: fmtNumber(2.445) })}</p>
  <p>{t('how.step2', { w: fmtNumber(5868), q: fmtNumber(2400) })}</p>
  <p>{t('how.step3', { q: fmtNumber(2400), p: fmtNumber(400), s: fmtNumber(80), total: fmtNumber(5280) })}</p>
  <p>{t('how.step4')}</p>
  <h3>{t('how.margin')}</h3>
  <p>{t('how.marginText')}</p>
  <h3>{t('how.sample')}</h3>
  <p>{t('how.sampleText')}</p>
</section>

<style>
  .how { display: grid; gap: 8px; }
  h2, h3, p { margin: 0; }
  button { justify-self: start; min-height: 44px; padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 16px; }
</style>
