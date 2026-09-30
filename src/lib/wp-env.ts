/**
 * Raw `AIYA_WP_API_URL` access for server modules that must stay importable
 * outside Astro (vitest). Reads process.env first (built standalone server
 * via --env-file) and falls back to import.meta.env (Astro dev, which loads
 * .env into import.meta.env but not process.env). Cached per process.
 */

let cached: string | null = null;

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
