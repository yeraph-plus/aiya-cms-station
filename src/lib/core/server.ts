// Astro rejects this module if an island or browser script tries to import it.
import { getSecret } from 'astro:env/server';
import { getDomain } from 'tldts';
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
 * The `Domain` attribute for the `aiya_session` cookie, derived straight
 * from AIYA_SITE_URL — no second constant to configure. The site's
 * registrable domain (www.site.name → site.name, PSL-aware so multi-part
 * suffixes like site.com.cn resolve correctly) makes the browser send the
 * session to every sibling subdomain app; only first-party subdomains may
 * live under it, since the cookie carries the visitor's bearer. Hosts
 * without a registrable domain — localhost, IP addresses, dev loops —
 * answer undefined, which keeps the cookie host-only exactly as before.
 */
export function sessionCookieDomain(): string | undefined {
  try {
    return getDomain(new URL(siteOrigin()).hostname, { allowPrivateDomains: true }) ?? undefined;
  } catch {
    // Unresolvable site configuration: the host-only cookie keeps auth
    // working in dev instead of failing the login path.
    return undefined;
  }
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
