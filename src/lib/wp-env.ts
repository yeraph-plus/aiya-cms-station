/**
 * Raw `AIYA_WP_API_URL` access for server modules that must stay importable
 * outside Astro (vitest). Reads process.env first (built standalone server
 * via --env-file) and falls back to import.meta.env (Astro dev, which loads
 * .env into import.meta.env but not process.env). Cached per process.
 */

let cached: string | null = null;

/** The one REST surface this build speaks. The env var carries the WP host
    only; this root is appended here so a deployment never has to spell the
    (version-frozen) path — and cannot mistype it. */
export const WP_API_CONTRACT_ROOT = '/wp-json/aiya/core/v1/';

/**
 * The full contract base from a configured WP origin: bare origins
 * (`https://wp.example.com`, with or without the trailing slash) get
 * {@link WP_API_CONTRACT_ROOT} appended, an already-complete root passes
 * through unchanged (older deploys keep working), anything else is returned
 * untouched so the client's own validation fails closed instead of guessing.
 * Unparseable input answers '' — the client turns that into the 503
 * configuration shape, exactly as a missing env var always has.
 */
export function wpApiBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (parsed.pathname === '' || parsed.pathname === '/') {
    parsed.pathname = WP_API_CONTRACT_ROOT;
  }
  return parsed.href;
}

export function rawWpApiUrl(): string {
  if (cached !== null) return cached;
  // `process` does not exist in browser bundles (islands import this chain
  // through lib/media.ts) — guard before touching it.
  const fromProcess = typeof process !== 'undefined' ? process.env?.AIYA_WP_API_URL : undefined;
  if (typeof fromProcess === 'string' && fromProcess !== '') {
    cached = fromProcess;
    return cached;
  }
  const fromImportMeta = (import.meta.env as unknown as Record<string, string | undefined>)
    .AIYA_WP_API_URL;
  cached = typeof fromImportMeta === 'string' ? fromImportMeta : '';
  return cached;
}

/** Origin of the WP install ('' when unconfigured/unparseable). One
    definition for the media URL rewriter and the /media proxy — the two
    consumers used to carry byte-identical copies that could drift. */
export function wpOrigin(): string {
  try {
    return new URL(rawWpApiUrl()).origin;
  } catch {
    return '';
  }
}
