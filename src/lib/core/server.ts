// Astro rejects this module if an island or browser script tries to import it.
import { getSecret } from 'astro:env/server';
import { createAiyaClient } from './client';
import { AiyaApiError } from './errors';

export function siteOrigin(): string {
  try {
    // Fail closed on a MISSING value too: the localhost fallback would
    // render the site fine while every canonical/og:url/JSON-LD/sitemap
    // pointed at localhost (page.server.ts documents the same contract).
    const configured = getSecret('AIYA_SITE_URL');
    if (configured === undefined || configured === '') throw new Error();
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new AiyaApiError('configuration', 503);
  }
}

/**
 * The one live transport configuration: content reads and visitor identity
 * both target the same WordPress install. A missing or malformed
 * AIYA_WP_API_URL is a configuration error, and plain HTTP is accepted only
 * on loopback or with AIYA_ALLOW_LOCAL_HTTP — the client enforces both.
 * When AIYA_PROXY_SECRET is set it authenticates the proxy bridge (the
 * secret header + X-Forwarded-For visitor address; the backend ignores the
 * pair unless they match its AIYA_PROXY_SECRET constant).
 */
function liveOptions(clientIp?: string | null) {
  return {
    baseUrl: getSecret('AIYA_WP_API_URL') ?? '',
    timeoutMs: Number(getSecret('AIYA_API_TIMEOUT_MS') ?? 8000),
    allowLocalHttp: getSecret('AIYA_ALLOW_LOCAL_HTTP') === 'true',
    proxySecret: getSecret('AIYA_PROXY_SECRET') ?? '',
    clientIp: clientIp ?? null,
  };
}

/**
 * Incoming request header this deployment trusts for the visitor address
 * (`X-Real-IP`, `CF-Connecting-IP`, …). Empty = the socket address stands.
 */
export function clientIpHeader(): string {
  return getSecret('AIYA_CLIENT_IP_HEADER') ?? '';
}

/**
 * Optional `Domain` attribute for the `aiya_session` cookie
 * (AIYA_SESSION_COOKIE_DOMAIN, e.g. `site.name`): sibling apps under one
 * registrable domain read the login state, because the browser then sends
 * the cookie to every subdomain instead of only the front-end origin.
 * Unset keeps the cookie host-only. The value is normalized (leading dot
 * and case) and syntax-checked; a value outside the site's own hostname
 * would make browsers silently drop the cookie — invisible login breakage
 * — so a non-suffix mismatch fails closed like every other configuration
 * error. Only point this at a domain whose every subdomain is first-party:
 * the cookie carries the visitor's bearer token.
 */
export function sessionCookieDomain(): string | undefined {
  const raw = getSecret('AIYA_SESSION_COOKIE_DOMAIN') ?? '';
  const value = raw.trim().replace(/^\./, '').toLowerCase();
  if (value === '') {
    // A leading dot is the classic scope syntax, but a value that
    // normalizes away entirely (`.`) is a typo, not an unset.
    if (raw.trim() === '') return undefined;
    throw new AiyaApiError('configuration', 503);
  }
  // At least two labels (a bare `localhost` cannot share subdomains) and
  // no scheme/port/path — those belong to a URL, not a cookie domain.
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      value,
    )
  ) {
    throw new AiyaApiError('configuration', 503);
  }
  const host = new URL(siteOrigin()).hostname;
  if (host !== value && !host.endsWith(`.${value}`)) {
    throw new AiyaApiError('configuration', 503);
  }
  return value;
}

/**
 * Anonymous read client for the public site. No machine credential
 * (decision 2026-09-10): the frontend implements no admin or preview
 * capability, so content reads are exactly what any visitor would see.
 * Revisit only if preview/admin is ever added.
 */
export function serverClient(clientIp?: string | null, excludeNsfw?: boolean) {
  return createAiyaClient({ ...liveOptions(clientIp), ...(excludeNsfw ? { excludeNsfw } : {}) });
}

/**
 * Identity client for visitor accounts (`/auth/*`, `/users/me`). Adds the
 * visitor's own bearer when the session carries one; without a token it is
 * equivalent to serverClient(). `excludeNsfw` threads the visitor's soft
 * switch into content list reads (see lib/nsfw.ts).
 */
export function authClient(
  bearer?: string | null,
  clientIp?: string | null,
  excludeNsfw?: boolean,
) {
  const token = bearer?.trim();
  return createAiyaClient({
    ...liveOptions(clientIp),
    ...(token ? { bearer: token } : {}),
    ...(excludeNsfw ? { excludeNsfw } : {}),
  });
}
