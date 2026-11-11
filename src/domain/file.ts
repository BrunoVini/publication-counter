import * as v from 'valibot';
import { validateScale } from './calc';
import type { Dataset } from './types';

export const CURRENT_FORMAT = 1;

// eslint-disable-next-line no-control-regex -- control characters are exactly what the schema rejects
const text = v.pipe(v.string(), v.maxLength(200), v.regex(/^[^\u0000-\u001F]*$/));
const id = v.pipe(text, v.minLength(1));
const date = v.pipe(
  v.string(), v.maxLength(64),
  v.regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/),
  v.check((s) => !Number.isNaN(Date.parse(s))),
);
// NOTE: upper bounds keep every calc result finite (10 tonnes, one million units).
const posNum = v.pipe(v.number(), v.finite(), v.gtValue(0), v.maxValue(1e7));
const posInt = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1e6));

const sample = v.strictObject({ units: posInt, weightG: posNum });
const entry = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('sample'), units: posInt, weightG: posNum }),
  v.strictObject({ id, kind: v.literal('weighing'), weightG: posNum }),
  v.strictObject({ id, kind: v.literal('sealed'), packs: posInt, perPack: posInt }),
  v.strictObject({ id, kind: v.literal('hand'), units: posInt }),
]);

const schema = v.strictObject({
  formatVersion: v.literal(1),
  datasetId: id,
  settings: v.strictObject({
    unit: v.picklist(['g', 'kg', 'lb', 'oz']),
    scale: v.nullable(v.array(v.strictObject({ upToG: posNum, resolutionG: posNum }))),
    theme: v.picklist(['light', 'dark', 'system']),
    language: v.optional(v.picklist(['pt', 'en', 'es'])),
    pubLanguage: v.optional(id),
    pubLanguages: v.optional(v.pipe(v.array(id), v.maxLength(2000))),
    locationName: v.optional(text),
    lastCounter: v.optional(text),
    firstRunDone: v.boolean(),
  }),
  publications: v.array(v.strictObject({
    id, name: text, language: text, variant: text,
    sample: v.optional(sample), packSize: v.optional(posInt),
    defaultMode: v.picklist(['weigh', 'hand']), archived: v.boolean(),
  })),
  counts: v.array(v.strictObject({
    id, startedAt: date, finishedAt: v.optional(date), counter: text,
    items: v.array(v.strictObject({
      publicationId: id, sample: v.optional(sample), entries: v.array(entry),
      zero: v.boolean(), entered: v.boolean(),
      snapshot: v.optional(v.strictObject({ name: text, language: text, variant: text })),
    })),
  })),
});

// NOTE: v1 needs no migration; future versions chain upgrades here before validation.
const migrate = (raw: unknown): unknown => raw;

function structureOk(ds: Dataset): boolean {
  const uniq = (xs: string[]) => new Set(xs).size === xs.length;
  const ids = new Set(ds.publications.map((p) => p.id));
  return ids.size === ds.publications.length
    && (ds.settings.scale === null || validateScale(ds.settings.scale) === 'ok')
    && uniq(ds.counts.map((c) => c.id))
    && ds.counts.filter((c) => !c.finishedAt).length <= 1
    && ds.counts.every((c) => uniq(c.items.map((i) => i.publicationId))
      && c.items.every((i) => (ids.has(i.publicationId) || !!i.snapshot)
        && uniq(i.entries.map((e) => e.id))
        && !(i.zero && i.entries.length > 0)
        && i.entries.filter((e) => e.kind === 'sample').length <= 1));
}

export const serializeDataset = (ds: Dataset): string => JSON.stringify(ds, null, 2);

/** Same schema and structural checks as parseDataset, for an in-memory value. */
export function validateDataset(ds: unknown): boolean {
  const r = v.safeParse(schema, ds);
  return r.success && structureOk(r.output);
}

export function parseDataset(textIn: string):
  { ok: true; dataset: Dataset } | { ok: false; error: 'notJson' | 'invalid' | 'tooNew' } {
  if (textIn.length > 5_000_000) return { ok: false, error: 'invalid' };
  let raw: unknown;
  try { raw = JSON.parse(textIn); } catch { return { ok: false, error: 'notJson' }; }
  const ver = (raw as { formatVersion?: unknown } | null)?.formatVersion;
  if (typeof ver === 'number' && ver > CURRENT_FORMAT) return { ok: false, error: 'tooNew' };
  const migrated = migrate(raw);
  if (!validateDataset(migrated)) return { ok: false, error: 'invalid' };
  // NOTE: parsed twice (validate, then output) to keep one validation path; files are small.
  return { ok: true, dataset: v.parse(schema, migrated) };
}

export function exportBaseName(ds: Dataset): string {
  const slug = (ds.settings.locationName ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'pubcount';
}

export const exportFileName = (ds: Dataset, today: string): string => `${exportBaseName(ds)}-${today}.pubcount`;
