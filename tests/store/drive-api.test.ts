import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriveError, ensureFolder, findFile, findLatestInFolder, upload } from '../../src/store/drive/api';

const meta = { id: 'f1', version: '3', modifiedTime: '2026-01-01T00:00:00Z' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const mock = (...rs: (Response | Error)[]) => {
  const f = vi.fn();
  for (const r of rs) r instanceof Error ? f.mockRejectedValueOnce(r) : f.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', f);
  return f;
};
const headers = (init: RequestInit) => init.headers as Record<string, string>;

afterEach(() => vi.unstubAllGlobals());

describe('drive api', () => {
  it('ensureFolder reuses an existing folder', async () => {
    const f = mock(json({ files: [{ id: 'fold' }] }));
    expect(await ensureFolder('tok')).toBe('fold');
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(decodeURIComponent(url)).toContain("name='Publication Counter'");
    expect(decodeURIComponent(url)).toContain('application/vnd.google-apps.folder');
    expect(decodeURIComponent(url)).toContain('trashed=false');
    expect(headers(init).Authorization).toBe('Bearer tok');
  });

  it('ensureFolder creates the folder when missing', async () => {
    const f = mock(json({ files: [] }), json({ id: 'new' }));
    expect(await ensureFolder('tok')).toBe('new');
    const [url, init] = f.mock.calls[1];
    expect(url).toBe('https://www.googleapis.com/drive/v3/files?fields=id');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Publication Counter',
      mimeType: 'application/vnd.google-apps.folder',
    });
  });

  it('findFile queries by appProperties not by name', async () => {
    const f = mock(json({ files: [meta] }));
    expect(await findFile('tok', 'ds1')).toEqual(meta);
    const q = decodeURIComponent(f.mock.calls[0][0]);
    expect(q).toContain("appProperties has { key='pubcountDatasetId' and value='ds1' } and trashed=false");
    expect(q).not.toContain('name=');
  });

  it('findFile returns null when absent', async () => {
    mock(json({ files: [] }));
    expect(await findFile('tok', 'ds1')).toBeNull();
  });

  it('upload without id creates multipart with appProperties and parent', async () => {
    const f = mock(json(meta));
    expect(await upload('tok', { folderId: 'fold', name: 'a.pubcount', datasetId: 'ds1', body: '{"x":1}' })).toEqual(meta);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version,modifiedTime');
    expect(init.method).toBe('POST');
    expect(headers(init).Authorization).toBe('Bearer tok');
    expect(headers(init)['Content-Type']).toMatch(/^multipart\/related; boundary=.+/);
    expect(init.body).toContain('"parents":["fold"]');
    expect(init.body).toContain('"appProperties":{"pubcountDatasetId":"ds1"}');
    expect(init.body).toContain('"name":"a.pubcount"');
    expect(init.body).toContain('{"x":1}');
  });

  it('upload with id patches multipart and refreshes appProperties without renaming', async () => {
    const f = mock(json(meta));
    await upload('tok', { id: 'f1', folderId: 'fold', name: 'a.pubcount', datasetId: 'ds1', body: '{"x":1}' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=multipart&fields=id,version,modifiedTime');
    expect(init.method).toBe('PATCH');
    expect(headers(init)['Content-Type']).toMatch(/^multipart\/related; boundary=.+/);
    expect(init.body).toContain('"appProperties":{"pubcountDatasetId":"ds1"}');
    expect(init.body).not.toContain('"name"');
    expect(init.body).not.toContain('"parents"');
    expect(init.body).toContain('{"x":1}');
  });

  it('findLatestInFolder lists the newest file in the folder', async () => {
    const f = mock(json({ files: [meta] }));
    expect(await findLatestInFolder('tok', 'fold')).toEqual(meta);
    const url = decodeURIComponent(f.mock.calls[0][0]);
    expect(url).toContain("q='fold' in parents and trashed=false");
    expect(url).toContain('orderBy=modifiedTime desc');
    expect(url).toContain('pageSize=1');
  });

  it('maps errors to kinds', async () => {
    const kind = async (r: Response | Error) => {
      mock(r);
      return findFile('tok', 'x').catch((e) => (e instanceof DriveError ? e.kind : 'other'));
    };
    expect(await kind(new Response('', { status: 401 }))).toBe('auth');
    expect(await kind(new Response('', { status: 429 }))).toBe('rateLimit');
    expect(await kind(new Response('', { status: 503 }))).toBe('server');
    expect(await kind(new Response('<html>', { status: 404 }))).toBe('notFound');
    expect(await kind(json({ error: { errors: [{ reason: 'insufficientPermissions' }] } }, 403))).toBe('auth');
    expect(await kind(json({ error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 403))).toBe('rateLimit');
    expect(await kind(json({ error: { errors: [{ reason: 'other' }] } }, 403))).toBe('server');
    expect(await kind(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('never leaks the token in error messages', async () => {
    mock(new TypeError('boom'));
    await expect(findFile('secret-tok', 'x')).rejects.toThrow(/^(?!.*secret-tok)/);
  });

  it('query escapes single quotes in datasetId', async () => {
    const f = mock(json({ files: [] }));
    await findFile('tok', "a'b");
    expect(decodeURIComponent(f.mock.calls[0][0])).toContain("value='a\\'b'");
  });
});
