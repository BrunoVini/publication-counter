<script lang="ts">
  import { fmtNumber, t } from '../../i18n/index.svelte';
  import Icon from '../shared/Icon.svelte';

  let { onback }: { onback: () => void } = $props();
</script>

<section class="stack">
  <button type="button" onclick={onback}><Icon name="back" /> {t('set.back')}</button>
  <h2>{t('how.title')}</h2>
  <p class="ex">{t('how.step1', { w: fmtNumber(489), n: fmtNumber(200), u: fmtNumber(2.445) })}</p>
  <p class="ex">{t('how.step2', { w: fmtNumber(5868), q: fmtNumber(2400) })}</p>
  <p class="ex">{t('how.step3', { q: fmtNumber(2400), p: fmtNumber(400), s: fmtNumber(80), total: fmtNumber(5280) })}</p>
  <p class="ex">{t('how.step4')}</p>
  <h3>{t('how.margin')}</h3>
  <p>{t('how.marginText')}</p>
  <h3>{t('how.sample')}</h3>
  <p>{t('how.sampleText')}</p>
</section>

<style>
  button { justify-self: start; }
  .ex { padding: var(--sp-3); border-radius: var(--radius); background: var(--surface); }
  h3 { margin-top: var(--sp-2); }
</style>
