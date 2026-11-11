import type { Dataset, Lang, Settings } from './types';

/** Codes in the public languages list; Portuguese maps to the Brazilian variant. */
export const DEFAULT_PUB_LANGUAGE: Record<Lang, string> = {
  pt: 'T', en: 'E', es: 'S', zh: 'CHS', hi: 'HI', fr: 'F', ar: 'A', bn: 'BE', ru: 'U', ur: 'UD', id: 'IN', de: 'X', ja: 'J', tr: 'TK', mr: 'MR',
};
/** The primary publication language, falling back to the UI language's code for old datasets. */
export const pubLanguageOf = (s: Settings, ui: Lang): string => s.pubLanguage || DEFAULT_PUB_LANGUAGE[ui];

export function emptyDataset(datasetId: string, settings: Partial<Settings> = {}): Dataset {
  return {
    formatVersion: 1,
    datasetId,
    settings: {
      unit: 'g', scale: null, theme: 'system', firstRunDone: false,
      ...Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)),
    },
    publications: [],
    counts: [],
  };
}


export { openCount } from './dataset-helpers';
export * from './dataset-publications';
export * from './dataset-entries';
