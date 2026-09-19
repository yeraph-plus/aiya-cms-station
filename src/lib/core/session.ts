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
 * logged-out instead of breaking the page.
 */
export async function currentUser(cookies: AstroCookies): Promise<User | null> {
  const token = readSessionToken(cookies);
  if (!token) return null;
  try {
    return (await authClient(token).me()).data;
  } catch {
    return null;
  }
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
