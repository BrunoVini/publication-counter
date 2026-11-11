import { itemTotal, type ItemTotal } from '../../domain/calc';
import type { CountItem, ScaleRange } from '../../domain/types';
import { fmtNumber, t } from '../../i18n/index.svelte';

export const totalText = (tt: ItemTotal): string =>
  tt.margin > 0 ? t('item.total', { n: fmtNumber(tt.units, 0), m: fmtNumber(tt.margin, 0) }) : fmtNumber(tt.units, 0);

export type Confirm = { kind: 'delete'; id: string } | { kind: 'recount' } | { kind: 'zero' };

export function itemSummary(item: CountItem | undefined, scale: ScaleRange[] | null): { total: ItemTotal | null; attention: boolean } {
  if (!item) return { total: null, attention: false };
  try { return { total: itemTotal(item, scale), attention: false }; } catch { return { total: null, attention: true }; }
}
