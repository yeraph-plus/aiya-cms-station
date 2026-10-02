import { afterEach, describe, expect, it } from 'vitest';
import type { AstroCookies } from 'astro';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '@/lib/core/session';
import { AiyaApiError } from '@/lib/core/errors';

// session.ts reads its configuration through astro:env/server (aliased to
// the process.env stub in vitest.config), so each case plants its own env.

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

const ENV_KEYS = ['AIYA_SESSION_COOKIE_DOMAIN', 'AIYA_SITE_URL'];

function plantEnv(domain?: string, siteUrl?: string) {
  if (domain === undefined) delete process.env.AIYA_SESSION_COOKIE_DOMAIN;
  else process.env.AIYA_SESSION_COOKIE_DOMAIN = domain;
  if (siteUrl === undefined) delete process.env.AIYA_SITE_URL;
  else process.env.AIYA_SITE_URL = siteUrl;
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('session cookie scoping (AIYA_SESSION_COOKIE_DOMAIN)', () => {
  it('keeps the cookie name and the host-only default', () => {
    expect(SESSION_COOKIE).toBe('aiya_session');
    plantEnv();
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe('aiya_session');
    expect(sets[0].options.domain).toBeUndefined();
    expect(sets[0].options.httpOnly).toBe(true);
    expect(sets[0].options.sameSite).toBe('lax');
  });

  it('carries the Domain attribute when configured', () => {
    plantEnv('example.com', 'https://www.example.com');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets[0].options.domain).toBe('example.com');
    expect(sets[0].options.secure).toBe(true);
  });

  it('normalizes a leading dot and letter case', () => {
    plantEnv('.Example.COM', 'https://www.example.com/');
    const { cookies, sets } = fakeCookies();
    setSessionCookie(cookies, '12.abc', 1800000000);
    expect(sets[0].options.domain).toBe('example.com');
  });

  it('accepts an exact-host domain as well as a parent suffix', () => {
    plantEnv('www.example.com', 'https://www.example.com');
    const { cookies, sets } = fakeCookies();
    expect(() => setSessionCookie(cookies, '12.abc', 1800000000)).not.toThrow();
    expect(sets[0].options.domain).toBe('www.example.com');
  });

  it('fails closed on a value outside the site hostname', () => {
    plantEnv('other.org', 'https://www.example.com');
    const { cookies } = fakeCookies();
    // A Domain the browser would silently reject means invisible login
    // breakage — the loud configuration error is the contract.
    expect(() => setSessionCookie(cookies, '12.abc', 1800000000)).toThrow(AiyaApiError);
  });

  it('fails closed on URL-shaped or dotless values', () => {
    for (const bad of ['https://example.com', 'example.com/', 'localhost', '.']) {
      plantEnv(bad, 'https://www.example.com');
      const { cookies } = fakeCookies();
      expect(() => setSessionCookie(cookies, '12.abc', 1800000000)).toThrow(AiyaApiError);
    }
  });

  it('clears a domain-scoped cookie with the same Domain attribute', () => {
    plantEnv('example.com', 'https://www.example.com');
    const { cookies, deletes } = fakeCookies();
    clearSessionCookie(cookies);
    expect(deletes).toEqual([
      { name: 'aiya_session', options: { path: '/', domain: 'example.com' } },
    ]);
  });

  it('clears host-only when unconfigured, and still clears when the configuration is broken', () => {
    plantEnv();
    const unconfigured = fakeCookies();
    clearSessionCookie(unconfigured.cookies);
    expect(unconfigured.deletes[0].options).toEqual({ path: '/' });

    // A broken configuration never delivered the scoped cookie either;
    // logout must not fail, it falls back to the host-only delete.
    plantEnv('other.org', 'https://www.example.com');
    const broken = fakeCookies();
    expect(() => clearSessionCookie(broken.cookies)).not.toThrow();
    expect(broken.deletes[0].options).toEqual({ path: '/' });
  });
});
