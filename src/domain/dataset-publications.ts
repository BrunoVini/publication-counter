import { clean, identityKey } from './text';
import type { Dataset, Publication } from './types';
import { copy, fail, findPub, newItem, openCount, posG, posInt } from './dataset-helpers';

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

const cleanIdentity = <T extends { name?: string; language?: string; variant?: string }>(p: T): T => {
  const out = { ...p };
  for (const k of ['name', 'language', 'variant'] as const) if (typeof out[k] === 'string') out[k] = clean(out[k]);
  return out;
};

export function addPublication(
  ds: Dataset, p: Omit<Publication, 'id' | 'archived'>, newId: () => string,
): Publication {
  const full: Publication = { ...cleanIdentity(p), id: newId(), archived: false };
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
  const { archived: _ignored, ...rest } = cleanIdentity(patch) as Partial<Publication>;
  if (rest.sample) rest.sample = copy(rest.sample);
  const merged = { ...p, ...rest };
  assertValidPublication(merged);
  assertUnique(ds, merged, id);
  Object.assign(p, rest);
  // NOTE: an open-count item without entries follows the new sample; one with entries keeps its own.
  if ('sample' in rest) {
    const item = openCount(ds)?.items.find((i) => i.publicationId === id);
    if (item && item.entries.length === 0) item.sample = rest.sample && copy(rest.sample);
  }
}

/** Always allowed: finished counts keep a snapshot of the identity, the open count loses the item. */
export function deletePublication(ds: Dataset, id: string): void {
  const p = findPub(ds, id);
  for (const c of ds.counts) {
    const idx = c.items.findIndex((i) => i.publicationId === id);
    if (idx < 0) continue;
    if (c.finishedAt) c.items[idx].snapshot = { name: p.name, language: p.language, variant: p.variant };
    else c.items.splice(idx, 1);
  }
  ds.publications.splice(ds.publications.indexOf(p), 1);
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
