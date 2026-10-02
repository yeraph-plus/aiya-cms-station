import { afterEach, describe, expect, it } from 'vitest';
import type { AstroCookies } from 'astro';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '@/lib/core/session';

// session.ts derives its configuration through astro:env/server (aliased
// to the process.env stub in vitest.config), so each case plants its own
// AIYA_SITE_URL. The cookie Domain comes from the site's registrable root
// — no second constant to configure.

type CookieOptions = Record<string, unknown>;

function fakeCookies() {
  const sets: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const deletes: Array<{ name: string; options?: CookieOptions }> = [];
  const cookies = {
    set(name: string, value: string, options: CookieOptions) {
      sets.push({ name, value, options });
    },
    delete(name: string, options?: CookieOptions) {
      deletes.push({ name, options });
    },
    get: () => undefined,
  } as unknown as AstroCookies;
  return { cookies, sets, deletes };
}

afterEach(() => {
  delete process.env.AIYA_SITE_URL;
});

function plantSite(siteUrl?: string) {
  if (siteUrl === undefined) delete process.env.AIYA_SITE_URL;
  else process.env.AIYA_SITE_URL = siteUrl;
}

describe('session cookie scoping (registrable root of AIYA_SITE_URL)', () => {
  it('keeps the cookie name and the shared constants', () => {
    expect(SESSION_COOKIE).toBe('aiya_session');
  });

  it('scopes the cookie to the registrable domain of the site URL', () => {
    plantSite('https://www.example.com/');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets[0].options.domain).toBe('example.com');
    expect(sets[0].options.secure).toBe(true);
    expect(sets[0].options.httpOnly).toBe(true);
    expect(sets[0].options.sameSite).toBe('lax');
  });

  it('resolves multi-part public suffixes through the PSL', () => {
    plantSite('https://www.example.com.cn/');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    // The naive last-two-labels read would answer 'com.cn' — a public
    // suffix the browser rejects, killing the cookie invisibly.
    expect(sets[0].options.domain).toBe('example.com.cn');
  });

  it('keeps the root scope on an apex deployment', () => {
    plantSite('https://example.com/');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets[0].options.domain).toBe('example.com');
  });

  it('keeps a private-suffix host scoped to itself', () => {
    plantSite('https://app.github.io/');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets[0].options.domain).toBe('app.github.io');
  });

  it('falls back to the host-only cookie on hosts without a root domain', () => {
    for (const siteUrl of ['http://localhost:4321/', 'http://127.0.0.1:4321/']) {
      plantSite(siteUrl);
      const { cookies, sets } = fakeCookies();
      setSessionCookie(cookies, '12.abc', 1800000000);
      expect(sets[0].options.domain).toBeUndefined();
    }
  });

  it('never throws on an unresolvable site configuration', () => {
    plantSite('not a url');
    const { cookies, sets } = fakeCookies();
    expect(() => setSessionCookie(cookies, '12.abc', 1800000000)).not.toThrow();
    expect(sets[0].options.domain).toBeUndefined();
  });

  it('clears the cookie with the same Domain the set used', () => {
    plantSite('https://www.example.com/');
    const scoped = fakeCookies();
    clearSessionCookie(scoped.cookies);
    expect(scoped.deletes[0].options).toEqual({ path: '/', domain: 'example.com' });

    plantSite('http://localhost:4321/');
    const hostOnly = fakeCookies();
    clearSessionCookie(hostOnly.cookies);
    expect(hostOnly.deletes[0].options).toEqual({ path: '/', domain: undefined });
  });
});
