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
 */
function liveOptions() {
  return {
    baseUrl: getSecret('AIYA_WP_API_URL') ?? '',
    timeoutMs: Number(getSecret('AIYA_API_TIMEOUT_MS') ?? 8000),
    allowLocalHttp: getSecret('AIYA_ALLOW_LOCAL_HTTP') === 'true',
  };
}

/**
 * Anonymous read client for the public site. No machine credential
 * (decision 2026-09-10): the frontend implements no admin or preview
 * capability, so content reads are exactly what any visitor would see.
 * Revisit only if preview/admin is ever added.
 */
export function serverClient() {
  return createAiyaClient(liveOptions());
}

/**
 * Identity client for visitor accounts (`/auth/*`, `/users/me`). Adds the
 * visitor's own bearer when the session carries one; without a token it is
 * equivalent to serverClient().
 */
export function authClient(bearer?: string) {
  const token = bearer?.trim();
  return createAiyaClient({ ...liveOptions(), ...(token ? { bearer: token } : {}) });
}
