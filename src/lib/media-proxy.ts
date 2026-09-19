/**
 * Media proxy core (`/media/wp-content/<path>`): streams uploads from WP so
 * the browser never touches the WP host (single-origin contract). Invoked
 * from the middleware — deliberately not a route, because
 * `trailingSlash: 'always'` would 404 file-like paths before routing ever
 * sees them. Range requests pass through for media seeking; long shared-
 * cache headers since uploads are effectively immutable (200 only — error
 * responses must not poison shared caches). `wp-json` can never be
 * reached — the wp-content prefix is part of the whitelist, not a filter.
 */

import { rawWpApiUrl } from '@/lib/wp-env';

const wpOrigin = (): string => {
  const raw = rawWpApiUrl();
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

/** Maps the pathname after `/media` onto an upstream URL, or null when suspicious. */
export function resolveMediaTarget(pathname: string): string | null {
  const origin = wpOrigin();
  if (origin === '') return null;
  // Decode once, tolerantly: consecutive valid escapes decode as a group
  // (multi-byte UTF-8 filenames), while malformed escapes — literal percents
  // in AC smilies filenames (`%3Q@…`) that Astro's trailingSlash redirect
  // has already decoded once — stay literal instead of throwing.
  const decoded = pathname
    .replace(/^\/+/, '')
    .replace(/^media\/?/, '')
    .replace(/\/+$/, '')
    .replace(/(?:%[0-9A-Fa-f]{2})+/g, (seq) => {
      try {
        return decodeURIComponent(seq);
      } catch {
        return seq;
      }
    });
  if (!decoded.startsWith('wp-content/') || decoded === 'wp-content/') return null;
  // `..`/`\` block traversal. A `%` followed by two hex digits AFTER decoding
  // means double-encoding — block it. A literal percent that is not a valid
  // escape (AC smilies pack filenames like `%3Q@…`) is legitimate but must be
  // re-encoded upstream (`%25`), or the server rejects the invalid escape.
  if (decoded.includes('..') || decoded.includes('\\') || /%[0-9a-fA-F]{2}/.test(decoded)) {
    return null;
  }
  return `${origin}/${decoded.replace(/%/g, '%25')}`;
}

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
] as const;

/** Request headers that make upstream 304s reachable (the backend sends ETags). */
const CONDITIONAL_HEADERS = ['if-none-match', 'if-modified-since'] as const;

/**
 * Content types the front origin is willing to render. Anything unknown is
 * downgraded to a raw download so a stray text/html (or scripted SVG before
 * the sandbox below) can never become stored XSS on the frontend origin.
 */
const RENDERABLE_TYPE = /^(image\/(?!svg)|video\/|audio\/|font\/|application\/pdf|text\/plain)/i;
const SVG_TYPE = /^image\/svg\+xml/i;

/** Handles one `/media/...` request; the caller adds security headers. */
export async function proxyMedia(pathname: string, request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const target = resolveMediaTarget(pathname);
  if (target === null) {
    return new Response('Not found', { status: 404 });
  }

  const requestHeaders: Record<string, string> = {};
  const range = request.headers.get('range');
  if (range) requestHeaders.Range = range;
  for (const name of CONDITIONAL_HEADERS) {
    const value = request.headers.get(name);
    if (value) requestHeaders[name] = value;
  }

  const upstream = await fetch(target, { headers: requestHeaders });
  const responseHeaders = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (upstream.ok && contentType !== '') {
    if (RENDERABLE_TYPE.test(contentType)) {
      // keep the upstream type
    } else if (SVG_TYPE.test(contentType)) {
      // Renders inline in <img>, but sandboxed when opened directly so any
      // embedded script cannot execute on the frontend origin.
      responseHeaders.set('Content-Security-Policy', 'sandbox');
    } else {
      responseHeaders.set('Content-Type', 'application/octet-stream');
      responseHeaders.set('Content-Disposition', 'attachment');
    }
  }

  if (upstream.status === 200) {
    responseHeaders.set('Cache-Control', 'public, max-age=604800');
  } else {
    responseHeaders.set('Cache-Control', 'no-store');
  }
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  return new Response(request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
