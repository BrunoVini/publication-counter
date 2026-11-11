export type WeightUnit = 'g' | 'kg' | 'lb' | 'oz';
export type Lang = 'pt' | 'en' | 'es';
export type Theme = 'light' | 'dark' | 'system';
/** Ascending by upToG; the last entry's upToG is the scale capacity. */
export interface ScaleRange { upToG: number; resolutionG: number }
export interface Sample { units: number; weightG: number }
export interface Publication {
  id: string; name: string; language: string; variant: string;
  sample?: Sample; packSize?: number; defaultMode: 'weigh' | 'hand'; archived: boolean;
}
export type Entry =
  | { id: string; kind: 'sample'; units: number; weightG: number }
  | { id: string; kind: 'weighing'; weightG: number }
  | { id: string; kind: 'sealed'; packs: number; perPack: number }
  | { id: string; kind: 'hand'; units: number };
/**
 * `sample` is the unit-weight snapshot for this count.
 * `entered` is the "entered" checkbox in the Summary for entry.
 */
export interface PublicationSnapshot { name: string; language: string; variant: string }
/** `snapshot` is stamped on finished counts when the publication is deleted, so history keeps its row. */
export interface CountItem {
  publicationId: string; sample?: Sample; entries: Entry[]; zero: boolean; entered: boolean;
  snapshot?: PublicationSnapshot;
}
export interface Count { id: string; startedAt: string; finishedAt?: string; counter: string; items: CountItem[] }
export interface Settings {
  unit: WeightUnit; scale: ScaleRange[] | null; theme: Theme; language?: Lang;
  /** Primary publication language code (not the UI language). */
  pubLanguage?: string;
  /** Secondary publication language codes. */
  pubLanguages?: string[];
  locationName?: string; lastCounter?: string; firstRunDone: boolean;
}
export interface Dataset { formatVersion: 1; datasetId: string; settings: Settings; publications: Publication[]; counts: Count[] }
