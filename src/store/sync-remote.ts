import { exportBaseName, parseDataset, serializeDataset } from '../domain/file';
import type { Dataset } from '../domain/types';
import type { DriveMeta } from './drive/api';

export type Summary = { modifiedAt: string; hasOpenCount: boolean; publications: number };

// NOTE: lazy so the Drive code stays out of the first-load bundle.
export const loadApi = () => import('./drive/api');
// NOTE: cached so a click handler can call requestToken with no await before it once warmed up.
let gisMod: typeof import('./drive/gis') | null = null;
export const cachedGis = () => gisMod;
export const loadGis = async () => (gisMod ??= await import('./drive/gis'));

/** Fire-and-forget: loads the Drive sign-in module and script so a later click opens the popup at once. */
export function warmDrive(): Promise<void> {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return Promise.resolve();
  return loadGis().then((g) => g.preloadGis()).catch(() => {});
}

export const summary = (ds: Dataset, modifiedAt: string): Summary =>
  ({ modifiedAt, hasOpenCount: ds.counts.some((c) => !c.finishedAt), publications: ds.publications.length });

export async function fetchRemote(token: string, id: string): Promise<Dataset> {
  const r = parseDataset(await (await loadApi()).download(token, id));
  if (!r.ok) throw `remote:${r.error}`;
  return r.dataset;
}

export async function uploadLocal(
  token: string, snapshot: () => Dataset, id?: string,
): Promise<{ meta: DriveMeta; at: string }> {
  const api = await loadApi();
  // NOTE: stamped before the snapshot so a save made during the upload is never older than lastSyncAt.
  const at = new Date().toISOString();
  const ds = snapshot();
  // NOTE: the name is only used on create; updates keep the existing Drive name.
  const meta = await api.upload(token, {
    id,
    folderId: id ? '' : await api.ensureFolder(token),
    name: `${exportBaseName(ds)}.pubcount`,
    datasetId: ds.datasetId,
    body: serializeDataset(ds),
  });
  return { meta, at };
}

export const gone = (p: Promise<void>) => p.catch((e) => { if ((e as { kind?: string })?.kind !== 'notFound') throw e; });

/** Classifies a sync failure: an auth failure only expires the session; anything else maps to a message key. */
export function describeError(e: unknown): { auth: boolean; key: string | null } {
  const kind = (e as { name?: string; kind?: string } | null)?.name === 'DriveError' ? (e as { kind: string }).kind : '';
  if (kind === 'auth') return { auth: true, key: null };
  const key = e === 'backupFailed' ? 'drive.err.backupFailed'
    : typeof e === 'string' && e.startsWith('remote:') ? `drive.err.${e.slice(7)}`
    : kind ? 'drive.err.network' : 'drive.err.generic';
  return { auth: false, key };
}
