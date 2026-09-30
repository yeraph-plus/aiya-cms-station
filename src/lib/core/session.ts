// Server-only session helpers for visitor accounts. The WP bearer token
// lives in an HttpOnly cookie; it never reaches browser scripts, islands
// or HTML. Importing server.ts pins this module to the Astro server.
import type { AstroCookies } from 'astro';
import type { User } from './contracts';
import { authClient, siteOrigin } from './server';

export const SESSION_COOKIE = 'aiya_session';

/** Tokens are `{userId}.{secret}` alphanumerics; anything else is not ours. */
export function readSessionToken(cookies: AstroCookies): string | null {
  const value = cookies.get(SESSION_COOKIE)?.value ?? '';

  return /^[0-9]{1,10}\.[A-Za-z0-9]{16,128}$/.test(value) ? value : null;
}

/**
 * The signed-in visitor, or null for guests and dead sessions. Any
 * failure (revoked token, backend down, contract drift) renders as
 * logged-out instead of breaking the page. Pass the middleware-resolved
 * visitor IP: without it `/users/me` skips the proxy bridge and the
 * request is attributed to the server's own REMOTE_ADDR.
 *
 * One page read calls this twice (session gate + loadPage shell); the
 * WeakMap keys on the request's own AstroCookies instance, so the second
 * call reuses the first read within the request and the entry dies with it.
 */
const meCache = new WeakMap<AstroCookies, Promise<User | null>>();

export function currentUser(cookies: AstroCookies, clientIp?: string | null): Promise<User | null> {
  const cached = meCache.get(cookies);
  if (cached) return cached;
  const read = (async (): Promise<User | null> => {
    const token = readSessionToken(cookies);
    if (!token) return null;
    try {
      return (await authClient(token, clientIp).me()).data;
    } catch {
      return null;
    }
  })();
  meCache.set(cookies, read);
  return read;
}

export function setSessionCookie(cookies: AstroCookies, token: string, expiresAt: number): void {
  let secure = false;
  try {
    secure = siteOrigin().startsWith('https:');
  } catch {
    /* malformed site URL: keep the cookie off-secure, dev only */
  }
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt * 1000),
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
