// Astro rejects this module if an island or browser script tries to import it.
import { getSecret } from 'astro:env/server';
import { createAiyaClient } from './client';
import { AiyaApiError } from './errors';

export function siteOrigin(): string {
  try {
    const url = new URL(getSecret('AIYA_SITE_URL') ?? 'http://localhost:4321');
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
