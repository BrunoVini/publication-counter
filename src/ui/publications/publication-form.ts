import { app } from '../../store/app.svelte';
import { i18n } from '../../i18n/index.svelte';
import { pubLanguageOf } from '../../domain/dataset';
import { fromGrams } from '../../domain/units';
import type { Publication } from '../../domain/types';

export interface Form {
  id: string | null; name: string; language: string; variant: string;
  units: string; weight: string; origUnits: string; origWeight: string; copyFrom: string; packSize: string; mode: 'weigh' | 'hand';
}

export const plain = (g: number): string =>
  String(Number(fromGrams(g, app.ds.settings.unit).toPrecision(6))).replace('.', i18n.lang === 'en' ? '.' : ',');

/** A blank form, or one prefilled from an existing publication. */
export function formFor(p?: Publication, name = ''): Form {
  if (!p) {
    return { id: null, name, language: pubLanguageOf(app.ds.settings, i18n.lang), variant: '', units: '', weight: '', origUnits: '', origWeight: '', copyFrom: '', packSize: '', mode: 'weigh' };
  }
  const units = p.sample ? String(p.sample.units) : '', weight = p.sample ? plain(p.sample.weightG) : '';
  return {
    id: p.id, name: p.name, language: p.language, variant: p.variant,
    units, weight, origUnits: units, origWeight: weight,
    copyFrom: '', packSize: p.packSize ? String(p.packSize) : '', mode: p.defaultMode,
  };
}
