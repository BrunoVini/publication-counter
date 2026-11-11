export type DriveMeta = { id: string; version: string; modifiedTime: string };
export type DriveErrorKind = 'auth' | 'network' | 'notFound' | 'rateLimit' | 'server';

export class DriveError extends Error {
  constructor(public kind: DriveErrorKind, message: string = kind) {
    super(message);
    this.name = 'DriveError';
  }
}

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FIELDS = 'id,version,modifiedTime';
const FOLDER_NAME = 'Publication Counter';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const BOUNDARY = 'pubcount_boundary_7f3a9c';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function kindFor(res: Response): Promise<DriveErrorKind> {
  const s = res.status;
  if (s === 401) return 'auth';
  if (s === 404) return 'notFound';
  if (s === 429) return 'rateLimit';
  if (s === 403) {
    // NOTE: body may not be JSON; fall through to 'server' when unreadable.
    let reason = '';
    try {
      reason = String((await res.json())?.error?.errors?.[0]?.reason ?? '');
    } catch { /* ignore */ }
    if (reason === 'authError' || reason === 'insufficientPermissions') return 'auth';
    if (reason.includes('rateLimitExceeded') || reason.includes('RateLimitExceeded')) return 'rateLimit';
  }
  return 'server';
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  } catch {
    throw new DriveError('network');
  }
  if (!res.ok) throw new DriveError(await kindFor(res), `drive http ${res.status}`);
  return res;
}

const list = async (token: string, q: string, fields: string) => {
  const res = await call(token, `${FILES}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`files(${fields})`)}&pageSize=1`);
  return ((await res.json()).files ?? []) as DriveMeta[];
};

export async function ensureFolder(token: string): Promise<string> {
  const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const [found] = await list(token, q, 'id');
  if (found) return found.id;
  const res = await call(token, `${FILES}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return (await res.json()).id;
}

export async function findFile(token: string, datasetId: string): Promise<DriveMeta | null> {
  const q = `appProperties has { key='pubcountDatasetId' and value='${esc(datasetId)}' } and trashed=false`;
  return (await list(token, q, FIELDS))[0] ?? null;
}

export async function getMeta(token: string, id: string): Promise<DriveMeta> {
  return (await call(token, `${FILES}/${encodeURIComponent(id)}?fields=${FIELDS}`)).json();
}

export async function download(token: string, id: string): Promise<string> {
  return (await call(token, `${FILES}/${encodeURIComponent(id)}?alt=media`)).text();
}

export async function upload(
  token: string,
  a: { id?: string; folderId: string; name: string; datasetId: string; body: string },
): Promise<DriveMeta> {
  if (a.id) {
    // NOTE: media-only update keeps the existing name and appProperties.
    const res = await call(token, `${UPLOAD}/${encodeURIComponent(a.id)}?uploadType=media&fields=${FIELDS}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: a.body,
    });
    return res.json();
  }
  const metadata = {
    name: a.name,
    parents: [a.folderId],
    mimeType: 'application/json',
    appProperties: { pubcountDatasetId: a.datasetId },
  };
  const body =
    `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n${a.body}\r\n--${BOUNDARY}--`;
  const res = await call(token, `${UPLOAD}?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
    body,
  });
  return res.json();
}
