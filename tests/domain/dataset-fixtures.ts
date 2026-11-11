import { addPublication, emptyDataset } from '../../src/domain/dataset';

export const mkId = () => { let n = 0; return () => `id${++n}`; };
export const pub = (name: string, extra = {}) => ({ name, language: 'pt', variant: '', defaultMode: 'weigh' as const, ...extra });
export const err = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as Error).message; } return 'no throw'; };

export function setup() {
  const newId = mkId();
  const ds = emptyDataset('d1');
  const a = addPublication(ds, pub('Alpha', { sample: { units: 10, weightG: 100 } }), newId);
  const b = addPublication(ds, pub('Beta'), newId);
  return { ds, newId, a, b };
}
