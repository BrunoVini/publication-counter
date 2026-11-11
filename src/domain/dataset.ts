import { identityKey } from './text';
import type { Count, CountItem, Dataset, Entry, Publication, Sample, Settings } from './types';

// NOTE: plain Omit collapses the Entry union, so distribute it to keep per-kind fields.
export type NewEntry = Entry extends infer E ? (E extends unknown ? Omit<E, 'id'> : never) : never;

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

export const openCount = (ds: Dataset): Count | undefined => ds.counts.find((c) => !c.finishedAt);

const fail = (code: string): never => { throw new Error(code); };
const copy = (s: Sample): Sample => ({ units: s.units, weightG: s.weightG });
const posG = (x: number) => Number.isFinite(x) && x > 0;
const posInt = (x: number) => Number.isInteger(x) && x >= 1;

function validEntry(e: Entry): boolean {
  switch (e.kind) {
    case 'weighing': return posG(e.weightG);
    case 'sample': return posInt(e.units) && posG(e.weightG);
    case 'hand': return posInt(e.units);
    case 'sealed': return posInt(e.packs) && posInt(e.perPack);
    default: return false;
  }
}

function findPub(ds: Dataset, id: string): Publication {
  return ds.publications.find((p) => p.id === id) ?? fail('notFound');
}

function findCount(ds: Dataset, countId: string): Count {
  return ds.counts.find((c) => c.id === countId) ?? fail('notFound');
}

function findItem(c: Count, pubId: string): CountItem {
  return c.items.find((i) => i.publicationId === pubId) ?? fail('notFound');
}

/** Resolves a count that must be open, plus the item for the publication. */
function editable(ds: Dataset, countId: string, pubId: string): CountItem {
  const c = findCount(ds, countId);
  if (c.finishedAt) fail('countFinished');
  return findItem(c, pubId);
}

const newItem = (p: Publication): CountItem => ({
  publicationId: p.id, sample: p.sample && copy(p.sample), entries: [], zero: false, entered: false,
});

function assertValidPublication(p: Omit<Publication, 'id'>): void {
  if (typeof p.name !== 'string' || p.name.trim() === '') fail('invalidPublication');
  if (p.packSize !== undefined && !posInt(p.packSize)) fail('invalidPublication');
  if (p.sample !== undefined && (!posInt(p.sample.units) || !posG(p.sample.weightG))) fail('invalidEntry');
}

function assertUnique(ds: Dataset, p: Omit<Publication, 'id'>, selfId?: string): void {
  if (p.archived) return;
  const key = identityKey(p);
  if (ds.publications.some((o) => o.id !== selfId && !o.archived && identityKey(o) === key)) fail('duplicate');
}

export function startCount(ds: Dataset, counter: string, nowIso: string, newId: () => string): Count {
  if (openCount(ds)) fail('countAlreadyOpen');
  const c: Count = {
    id: newId(), startedAt: nowIso, counter,
    items: ds.publications.filter((p) => !p.archived).map(newItem),
  };
  ds.counts.push(c);
  ds.settings.lastCounter = counter;
  return c;
}

export function finishCount(ds: Dataset, countId: string, nowIso: string): void {
  const c = findCount(ds, countId);
  if (c.finishedAt) fail('countFinished');
  c.finishedAt = nowIso;
}

export function reopenCount(ds: Dataset, countId: string): void {
  const c = findCount(ds, countId);
  if (!c.finishedAt) return;
  if (openCount(ds)) fail('countAlreadyOpen');
  delete c.finishedAt;
}

export function addPublication(
  ds: Dataset, p: Omit<Publication, 'id' | 'archived'>, newId: () => string,
): Publication {
  const full: Publication = { ...p, id: newId(), archived: false };
  if (full.sample) full.sample = copy(full.sample);
  assertValidPublication(full);
  assertUnique(ds, full);
  ds.publications.push(full);
  // Read back so callers get the (possibly reactive) stored object.
  const stored = ds.publications[ds.publications.length - 1];
  openCount(ds)?.items.push(newItem(stored));
  return stored;
}

export function updatePublication(
  ds: Dataset, id: string, patch: Partial<Omit<Publication, 'id' | 'archived'>>,
): void {
  const p = findPub(ds, id);
  // NOTE: archived only changes through archivePublication (it maintains the open count).
  const { archived: _ignored, ...rest } = patch as Partial<Publication>;
  if (rest.sample) rest.sample = copy(rest.sample);
  const merged = { ...p, ...rest };
  assertValidPublication(merged);
  assertUnique(ds, merged, id);
  Object.assign(p, rest);
}

export function archivePublication(ds: Dataset, id: string, archived: boolean): void {
  const p = findPub(ds, id);
  if (!archived) assertUnique(ds, { ...p, archived: false }, id);
  p.archived = archived;
  const open = openCount(ds);
  if (!open) return;
  const idx = open.items.findIndex((i) => i.publicationId === id);
  if (archived) {
    const it = open.items[idx];
    if (it && it.entries.length === 0 && !it.zero) open.items.splice(idx, 1);
  } else if (idx < 0) {
    open.items.push(newItem(p));
  }
}

export function copySample(ds: Dataset, fromId: string, toId: string): void {
  const from = findPub(ds, fromId);
  const to = findPub(ds, toId);
  if (!from.sample) fail('missingSample');
  to.sample = copy(from.sample!);
  const item = openCount(ds)?.items.find((i) => i.publicationId === toId);
  if (item) item.sample = copy(from.sample!);
}

export function setSample(
  ds: Dataset, countId: string, pubId: string, s: Sample, newId: () => string,
): { replacedPrevious: boolean } {
  const item = editable(ds, countId, pubId);
  const p = findPub(ds, pubId);
  if (!posInt(s.units) || !posG(s.weightG)) fail('invalidEntry');
  const idx = item.entries.findIndex((e) => e.kind === 'sample');
  const entry: Entry = { id: idx >= 0 ? item.entries[idx].id : newId(), kind: 'sample', ...copy(s) };
  if (idx >= 0) item.entries[idx] = entry;
  else item.entries.unshift(entry);
  item.zero = false;
  item.sample = copy(s);
  p.sample = copy(s);
  return { replacedPrevious: idx >= 0 };
}

export function addEntry(
  ds: Dataset, countId: string, pubId: string, e: NewEntry, newId: () => string,
): Entry {
  const item = editable(ds, countId, pubId);
  const entry = { ...e, id: newId() } as Entry;
  if (!validEntry(entry)) fail('invalidEntry');
  if (entry.kind === 'weighing' && !item.sample) fail('missingSample');
  item.entries.push(entry);
  item.zero = false;
  return item.entries[item.entries.length - 1];
}

export function updateEntry(
  ds: Dataset, countId: string, pubId: string, entryId: string, patch: Partial<Entry>,
): void {
  const item = editable(ds, countId, pubId);
  const idx = item.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) fail('notFound');
  const old = item.entries[idx];
  if (old.kind === 'sample') fail('useSetSample');
  if (patch.kind !== undefined && patch.kind !== old.kind) fail('invalidEntry');
  const fields = { weighing: ['weightG'], sealed: ['packs', 'perPack'], hand: ['units'], sample: [] }[old.kind];
  const merged = { id: old.id, kind: old.kind } as Record<string, unknown>;
  for (const f of fields) merged[f] = (f in patch ? patch : old)[f as keyof Entry];
  if (!validEntry(merged as unknown as Entry)) fail('invalidEntry');
  item.entries[idx] = merged as unknown as Entry;
}

export function deleteEntry(ds: Dataset, countId: string, pubId: string, entryId: string): void {
  const item = editable(ds, countId, pubId);
  const idx = item.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) fail('notFound');
  if (item.entries[idx].kind === 'sample') fail('useSetSample');
  item.entries.splice(idx, 1);
}

export function markZero(ds: Dataset, countId: string, pubId: string): void {
  const item = editable(ds, countId, pubId);
  item.entries = [];
  item.zero = true;
}

export function resetItem(ds: Dataset, countId: string, pubId: string): void {
  const item = editable(ds, countId, pubId);
  item.entries = [];
  item.zero = false;
}

// NOTE: allowed on finished counts: the entry checkbox is ticked while transcribing a finished count.
export function setEntered(ds: Dataset, countId: string, pubId: string, entered: boolean): void {
  findItem(findCount(ds, countId), pubId).entered = entered;
}

