import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Cfg = { callback: (r: any) => void; error_callback: (e: any) => void };
let cfg: Cfg;
let request: ReturnType<typeof vi.fn>;
let appended: number;
let failLoad: boolean;
let granted: boolean;

async function load() {
  vi.resetModules();
  return import('../../src/store/drive/gis');
}

beforeEach(() => {
  appended = 0;
  failLoad = false;
  granted = true;
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cid');
  request = vi.fn();
  vi.spyOn(document.head, 'appendChild').mockImplementation(((el: any) => {
    appended++;
    if (failLoad) setTimeout(() => el.onerror?.(new Event('error')));
    else {
      (window as any).google = {
        accounts: {
          oauth2: {
            initTokenClient: (c: Cfg) => {
              cfg = c;
              return { requestAccessToken: request };
            },
            hasGrantedAllScopes: () => granted,
            revoke: vi.fn((_t: string, done: () => void) => done()),
          },
        },
      };
      setTimeout(() => el.onload?.(new Event('load')));
    }
    return el;
  }) as any);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete (window as any).google;
});

describe('drive gis', () => {
  it('loads the gsi script only once', async () => {
    const { requestToken } = await load();
    const p1 = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    cfg.callback({ access_token: 'a', expires_in: 3600 });
    await p1;
    const p2 = requestToken(false);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    cfg.callback({ access_token: 'b', expires_in: 3600 });
    await p2;
    expect(appended).toBe(1);
  });

  it('resolves token with expiresAt one minute early', async () => {
    const { requestToken } = await load();
    const now = Date.now();
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith({ prompt: 'consent' }));
    cfg.callback({ access_token: 'tok', expires_in: 3600 });
    const r = await p;
    expect(r.token).toBe('tok');
    expect(r.expiresAt).toBeGreaterThanOrEqual(now + 3540_000);
    expect(r.expiresAt).toBeLessThanOrEqual(Date.now() + 3540_000);
  });

  it('non-interactive uses empty prompt', async () => {
    const { requestToken } = await load();
    const p = requestToken(false);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith({ prompt: '' }));
    cfg.callback({ access_token: 't', expires_in: 60 });
    await p;
  });

  it('error_callback rejects with AuthCancelled', async () => {
    const { requestToken, AuthCancelled } = await load();
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    cfg.error_callback({ type: 'popup_closed' });
    await expect(p).rejects.toBeInstanceOf(AuthCancelled);
  });

  it('callback error maps to AuthCancelled keeping the reason', async () => {
    const { requestToken, AuthCancelled } = await load();
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    cfg.callback({ error: 'access_denied' });
    await expect(p).rejects.toThrow(AuthCancelled);
    await expect(p).rejects.toThrow('access_denied');
  });

  it('missing drive.file scope rejects with scopeDenied', async () => {
    granted = false;
    const { requestToken, AuthCancelled } = await load();
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    cfg.callback({ access_token: 't', expires_in: 3600 });
    await expect(p).rejects.toBeInstanceOf(AuthCancelled);
    await expect(p).rejects.toThrow('scopeDenied');
  });

  it('a new request supersedes the pending one', async () => {
    const { requestToken, AuthCancelled } = await load();
    const p1 = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const p2 = requestToken(true);
    await expect(p1).rejects.toBeInstanceOf(AuthCancelled);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    cfg.callback({ access_token: 'x', expires_in: 3600 });
    expect((await p2).token).toBe('x');
  });

  it('script load failure rejects and allows retry', async () => {
    const { requestToken } = await load();
    failLoad = true;
    await expect(requestToken(true)).rejects.toThrow();
    failLoad = false;
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    cfg.callback({ access_token: 't', expires_in: 3600 });
    await expect(p).resolves.toMatchObject({ token: 't' });
    expect(appended).toBe(2);
  });

  it('rejects notConfigured without a client id', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { requestToken } = await load();
    await expect(requestToken(true)).rejects.toThrow('notConfigured');
    expect(appended).toBe(0);
  });

  it('driveConfigured false when client id empty', async () => {
    const { driveConfigured } = await load();
    expect(driveConfigured()).toBe(true);
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    expect(driveConfigured()).toBe(false);
  });

  it('revoke calls google revoke', async () => {
    const { requestToken, revoke } = await load();
    const p = requestToken(true);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    cfg.callback({ access_token: 't', expires_in: 3600 });
    await p;
    await revoke('t');
    expect((window as any).google.accounts.oauth2.revoke).toHaveBeenCalledWith('t', expect.any(Function));
  });
});
