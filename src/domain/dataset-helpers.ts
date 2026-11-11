import type { Count, CountItem, Dataset, Publication, Sample } from './types';

export const openCount = (ds: Dataset): Count | undefined => ds.counts.find((c) => !c.finishedAt);

export const fail = (code: string): never => { throw new Error(code); };
export const copy = (s: Sample): Sample => ({ units: s.units, weightG: s.weightG });
export const posG = (x: number) => Number.isFinite(x) && x > 0;
export const posInt = (x: number) => Number.isInteger(x) && x >= 1;

export function findPub(ds: Dataset, id: string): Publication {
  return ds.publications.find((p) => p.id === id) ?? fail('notFound');
}

export function findCount(ds: Dataset, countId: string): Count {
  return ds.counts.find((c) => c.id === countId) ?? fail('notFound');
}

export function findItem(c: Count, pubId: string): CountItem {
  return c.items.find((i) => i.publicationId === pubId) ?? fail('notFound');
}

/** Resolves a count that must be open, plus the item for the publication. */
export function editable(ds: Dataset, countId: string, pubId: string): CountItem {
  const c = findCount(ds, countId);
  if (c.finishedAt) fail('countFinished');
  return findItem(c, pubId);
}

export const newItem = (p: Publication): CountItem => ({
  publicationId: p.id, sample: p.sample && copy(p.sample), entries: [], zero: false, entered: false,
});
