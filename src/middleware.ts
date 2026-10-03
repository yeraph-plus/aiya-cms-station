import { defineMiddleware } from 'astro:middleware';
import { visitorIp } from '@/lib/api-auth';
import { backend } from '@/lib/core/health';
import { gateResponse } from '@/lib/gate';
import { normalizeLocale, t } from '@/lib/i18n';
import { proxyMedia } from '@/lib/media-proxy';

/** The security-header baseline every response carries — pages, redirects,
 *  gate pages and media alike (redirects have no body, but a uniform header
 *  face keeps the audit simple and future-proofs new exit points). */
function stampSecurityHeaders(response: Response): Response {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  // Defense-in-depth base trio (no script-src yet: the pre-paint theme
  // script is inline; a nonce pipeline is its own batch). The sanitize-html
  // boundary stays the first line for content HTML.
  response.headers.set(
    'Content-Security-Policy',
    "object-src 'none'; frame-ancestors 'self'; base-uri 'none'",
  );
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Resolve the visitor address once per request; every SSR read threads it
  // into its client so the backend sees the real visitor, not this server's
  // REMOTE_ADDR (rate limiting / guest dedup / comment IP share one bucket
  // otherwise).
  context.locals.visitorIp = visitorIp(
    context.request,
    typeof context.clientAddress === 'string' ? context.clientAddress : null,
  );

  // Media proxy runs before routing: a route-level trailing-slash rule would
  // 404 file-like paths (no trailing slash) before any route could match.
  if (context.url.pathname.startsWith('/media/')) {
    const response = await proxyMedia(context.url.pathname, context.request);
    return stampSecurityHeaders(response);
  }

  // Canonical URL shape (astro.config keeps trailingSlash 'ignore' so the
  // media paths above and dot segments never 404 at the router): GET/HEAD
  // page requests bounce 308 to the slash form — dot-bearing last segments
  // (robots.txt, sitemap.xml) and the API surface are exempt. Leading
  // double slashes collapse first: a `//x` Location would parse as
  // protocol-relative and bounce the visitor to an external host.
  let { pathname } = context.url;
  const safeMethod = context.request.method === 'GET' || context.request.method === 'HEAD';
  if (safeMethod && pathname.startsWith('//')) {
    pathname = pathname.replace(/^\/+/, '/');
    return stampSecurityHeaders(context.redirect(pathname + context.url.search, 308));
  }
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';

  // Retired routes: the membership page folded into the account hub
  // (wallet bubble + membership modal on /profile/me/).
  if (safeMethod && (pathname === '/membership' || pathname === '/membership/')) {
    return stampSecurityHeaders(context.redirect('/profile/me/' + context.url.search, 308));
  }
  if (
    safeMethod &&
    pathname !== '/' &&
    !pathname.endsWith('/') &&
    !pathname.startsWith('/api/') &&
    !lastSegment.includes('.')
  ) {
    return stampSecurityHeaders(context.redirect(pathname + '/' + context.url.search, 308));
  }

  // Site gate: every page request asks the content service before anything
  // is rendered. When it cannot answer, the request stops here — no page is
  // assembled, so no route needs to know the gate exists. Scoped to requests
  // that want HTML: the JSON proxy and file-like paths own their own errors.
  const accept = context.request.headers.get('accept') ?? '';
  const wantsHtml = accept === '' || accept.includes('text/html') || accept.includes('*/*');
  if (safeMethod && wantsHtml && !pathname.startsWith('/api/') && !lastSegment.includes('.')) {
    if (!(await backend.isReachable())) {
      const preferred = context.request.headers.get('accept-language')?.split(',')[0] ?? null;
      const locale = normalizeLocale(preferred);
      return stampSecurityHeaders(gateResponse(locale, t(locale), pathname + context.url.search));
    }
  }

  const response = await next();
  // Crawler-facing endpoints are cheap to cache briefly (the sitemap walks
  // up to hundreds of upstream list pages); everything else stays uncached
  // until the public projection and its invalidation are designed. A
  // transient empty sitemap (upstream hiccup mid-walk) must not be cached:
  // the route marks it and the cache window is skipped.
  const emptySitemap =
    context.url.pathname === '/sitemap.xml' && response.headers.get('X-Aiya-Sitemap-Empty') === '1';
  response.headers.delete('X-Aiya-Sitemap-Empty');
  if (
    response.status === 200 &&
    !emptySitemap &&
    (context.url.pathname === '/sitemap.xml' || context.url.pathname === '/robots.txt')
  ) {
    response.headers.set('Cache-Control', 'public, max-age=300');
  } else {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  return stampSecurityHeaders(response);
});
