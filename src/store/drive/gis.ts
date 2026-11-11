export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

export class AuthCancelled extends Error {
  constructor(message = 'cancelled') {
    super(message);
    this.name = 'AuthCancelled';
  }
}

type Token = { token: string; expiresAt: number };

// NOTE: read at call time so tests can stub the env var.
const clientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const driveConfigured = (): boolean => clientId() !== '';

let script: Promise<void> | null = null;
function loadScript(): Promise<void> {
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = GSI_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      script = null;
      reject(new Error('gsiLoadFailed'));
    };
    document.head.appendChild(el);
  });
  return script;
}

let client: google.accounts.oauth2.TokenClient | null = null;
// NOTE: single pending request; a new one supersedes (and rejects) the old.
let pending: { resolve: (t: Token) => void; reject: (e: Error) => void } | null = null;

function settle(fn: (p: NonNullable<typeof pending>) => void) {
  const p = pending;
  pending = null;
  if (p) fn(p);
}

/**
 * Fire-and-forget script load. Call it early (e.g. when the settings cloud
 * section mounts) so a later requestToken does not await the network.
 */
export function preloadGis(): Promise<void> {
  if (!driveConfigured()) return Promise.resolve();
  // NOTE: errors are swallowed; a later requestToken retries the load.
  return loadScript().catch(() => {});
}

/**
 * Must be called directly from a click handler. Call preloadGis() earlier
 * (e.g. when the settings cloud section mounts) so the popup opens inside
 * the user gesture.
 */
export async function requestToken(interactive: boolean): Promise<Token> {
  if (!driveConfigured()) throw new Error('notConfigured');
  await loadScript();
  pending?.reject(new AuthCancelled('superseded'));
  pending = null;
  client ??= google.accounts.oauth2.initTokenClient({
    client_id: clientId(),
    scope: DRIVE_SCOPE,
    callback: (r) => {
      if (r.error) return settle((p) => p.reject(new AuthCancelled(r.error)));
      if (!r.access_token) return settle((p) => p.reject(new AuthCancelled('noToken')));
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) {
        return settle((p) => p.reject(new AuthCancelled('scopeDenied')));
      }
      const token = r.access_token;
      settle((p) => p.resolve({ token, expiresAt: Date.now() + (Number(r.expires_in) - 60) * 1000 }));
    },
    error_callback: (e) => settle((p) => p.reject(new AuthCancelled(e?.type ?? 'cancelled'))),
  });
  return new Promise<Token>((resolve, reject) => {
    pending = { resolve, reject };
    try {
      client!.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch (e) {
      pending = null;
      reject(e);
    }
  });
}

export async function revoke(token: string): Promise<void> {
  await loadScript();
  await new Promise<void>((resolve) => google.accounts.oauth2.revoke(token, () => resolve()));
}
