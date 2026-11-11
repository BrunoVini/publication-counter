import { describe, expect, it } from 'vitest';
import headers from '../../public/_headers?raw';
import html from '../../index.html?raw';

const cspOf = (text: string) => text.match(/Content-Security-Policy(?:: |" content=")([^"\n]*)/)![1];

describe.each([['_headers', headers], ['index.html', html]])('CSP in %s', (_name, text) => {
  const csp = cspOf(text);
  it('allows the Google sign-in and Drive sources', () => {
    expect(csp).toContain("script-src 'self' https://accounts.google.com");
    expect(csp).toContain("connect-src 'self' https://www.googleapis.com https://accounts.google.com");
    expect(csp).toContain('frame-src https://accounts.google.com');
  });
  it('has no unsafe-eval and no wildcard source', () => {
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/(^|\s)\*/);
  });
});
