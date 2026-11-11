/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

// Minimal ambient typing for the Google Identity Services token client.
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token?: string;
    expires_in?: number | string;
    error?: string;
    error_description?: string;
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }): TokenClient;
  function hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
  function revoke(token: string, done?: () => void): void;
}
