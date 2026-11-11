<script lang="ts">
  import { act } from '../../store/app.svelte';
  import { fmtNumber, t } from '../../i18n/index.svelte';
  import { deleteEntry, markZero, resetItem } from '../../domain/dataset';
  import type { CountItem } from '../../domain/types';
  import ConfirmDialog from '../shared/ConfirmDialog.svelte';
  import type { Confirm } from './item-format';

  let { confirm = $bindable(), item, countId, pubId, fmtW, run }: {
    confirm: Confirm | null; item: CountItem | undefined; countId: string; pubId: string;
    fmtW: (g: number) => string; run: (fn: () => void) => boolean;
  } = $props();

  const dialog = $derived.by(() => {
    const c = confirm;
    if (!c) return { title: '', message: '', label: '' };
    if (c.kind === 'recount') return { title: t('item.recount.title'), message: t('item.recount.message'), label: t('item.recount.confirm') };
    if (c.kind === 'zero') return { title: t('item.zero.title'), message: t('item.zero.message'), label: t('item.zero.confirm') };
    const e = item?.entries.find((x) => x.id === c.id);
    const message = !e || e.kind === 'sample' ? ''
      : e.kind === 'weighing' ? t('entry.delete.weighing', { value: fmtW(e.weightG) })
      : e.kind === 'sealed' ? t('entry.delete.sealed', { packs: fmtNumber(e.packs, 0), perPack: fmtNumber(e.perPack, 0) })
      : t('entry.delete.hand', { units: fmtNumber(e.units, 0) });
    return { title: t('entry.delete.title'), message, label: t('entry.delete.confirm') };
  });
  function doConfirm(): void {
    const c = confirm;
    confirm = null;
    if (!c) return;
    if (c.kind === 'delete') run(() => act((ds) => deleteEntry(ds, countId, pubId, c.id)));
    else if (c.kind === 'recount') run(() => act((ds) => resetItem(ds, countId, pubId)));
    else run(() => act((ds) => markZero(ds, countId, pubId)));
  }
</script>

<ConfirmDialog open={confirm !== null} title={dialog.title} message={dialog.message} confirmLabel={dialog.label}
  danger onconfirm={doConfirm} oncancel={() => (confirm = null)} />
