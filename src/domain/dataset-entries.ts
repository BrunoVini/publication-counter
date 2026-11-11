import { clean } from './text';
import type { Count, Dataset, Entry, Sample } from './types';
import { copy, editable, fail, findCount, findItem, findPub, newItem, openCount, posG, posInt } from './dataset-helpers';

// NOTE: plain Omit collapses the Entry union, so distribute it to keep per-kind fields.
export type NewEntry = Entry extends infer E ? (E extends unknown ? Omit<E, 'id'> : never) : never;

function validEntry(e: Entry): boolean {
  switch (e.kind) {
    case 'weighing': return posG(e.weightG);
    case 'sample': return posInt(e.units) && posG(e.weightG);
    case 'hand': return posInt(e.units);
    case 'sealed': return posInt(e.packs) && posInt(e.perPack);
    default: return false;
  }
}

export function startCount(ds: Dataset, rawCounter: string, nowIso: string, newId: () => string): Count {
  if (openCount(ds)) fail('countAlreadyOpen');
  const counter = clean(rawCounter);
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
  const entry = { ...e, id: newId() };
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

