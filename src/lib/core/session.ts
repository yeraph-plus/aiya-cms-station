// Server-only session helpers for visitor accounts. The WP bearer token
// lives in an HttpOnly cookie; it never reaches browser scripts, islands
// or HTML. Importing server.ts pins this module to the Astro server.
import type { AstroCookies } from 'astro';
import type { User } from './contracts';
import { authClient, sessionCookieDomain, siteOrigin } from './server';

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

/**
 * The Domain scope for this response's session cookie: the site's
 * registrable root, unless the browsed host sits outside it (server IP,
 * LAN name, alternate hostname) — there the browser would reject a
 * Domain=root cookie outright, so the host-only shape keeps login alive
 * and the mismatch is logged for the operator.
 */
function resolveScope(requestHost?: string): string | undefined {
  const root = sessionCookieDomain();
  if (!root) return undefined;
  const host = requestHost?.toLowerCase();
  if (host && host !== root && !host.endsWith(`.${root}`)) {
    console.error(
      `[aiya] session cookie stays host-only: browsed host "${host}" is outside AIYA_SITE_URL's root "${root}"`,
    );
    return undefined;
  }
  return root;
}

export function setSessionCookie(
  cookies: AstroCookies,
  token: string,
  expiresAt: number,
  requestHost?: string,
): void {
  let secure = false;
  try {
    secure = siteOrigin().startsWith('https:');
  } catch {
    /* malformed site URL: keep the cookie off-secure, dev only */
  }
  // Domain is derived from AIYA_SITE_URL's registrable root (sibling
  // subdomain apps share the session); localhost/IP answers undefined and
  // keeps the cookie host-only. Never throws — see sessionCookieDomain.
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: new Date(expiresAt * 1000),
    domain: resolveScope(requestHost),
  });
}

/**
 * Header clearing the LEGACY host-only session shape. Login/register/
 * logout append it beside the AstroCookies Set-Cookie (which can only
 * carry one entry per name): browsers order same-path cookies oldest
 * first and the SSR parser keeps the first, so a leftover pre-0.5.2
 * host-only cookie would shadow the fresh domain-scoped one on the very
 * next read — success toast, reload, still a guest. No Domain attribute:
 * this targets the host-only shape only, never the scoped cookie.
 */
export function legacySessionDeleteHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie(cookies: AstroCookies, requestHost?: string): void {
  // The delete must carry the same Domain the cookie was set with — a
  // host-only clear cannot remove a domain-scoped cookie, logout would
  // leave the session alive on every subdomain. The legacy host-only
  // shape is cleared by the appended header in the calling proxy.
  cookies.delete(SESSION_COOKIE, { path: '/', domain: resolveScope(requestHost) });
}
