import { defineMiddleware } from 'astro:middleware';
import { visitorIp } from '@/lib/api-auth';
import { backend } from '@/lib/core/health';
import { gateResponse } from '@/lib/gate';
import { normalizeLocale, t } from '@/lib/i18n';
import { proxyMedia } from '@/lib/media-proxy';

export const onRequest = defineMiddleware(async (context, next) => {
  // Resolve the visitor address once per request; every SSR read threads it
  // into its client so the backend sees the real visitor, not this server's
  // REMOTE_ADDR (rate limiting / guest dedup / comment IP share one bucket
  // otherwise).
  context.locals.visitorIp = visitorIp(
    context.request,
    typeof context.clientAddress === 'string' ? context.clientAddress : null,
  );

  // Media proxy runs before routing: `trailingSlash: 'always'` would 404
  // file-like paths (no trailing slash) before any route could match.
  if (context.url.pathname.startsWith('/media/')) {
    const response = await proxyMedia(context.url.pathname, context.request);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  }

  // Trailing-slash normalization: with 'always', the bare form of every
  // route would 404 (Astro dev does not redirect on its own). GET/HEAD page
  // requests bounce 308 to the slash form — dot-bearing last segments
  // (robots.txt, sitemap.xml) and the API surface are exempt.
  const { pathname } = context.url;
  const safeMethod = context.request.method === 'GET' || context.request.method === 'HEAD';
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  if (
    safeMethod &&
    pathname !== '/' &&
    !pathname.endsWith('/') &&
    !pathname.startsWith('/api/') &&
    !lastSegment.includes('.')
  ) {
    return context.redirect(pathname + '/' + context.url.search, 308);
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
      return gateResponse(locale, t(locale), pathname + context.url.search);
    }
  }

  const response = await next();
  // Crawler-facing endpoints are cheap to cache briefly (the sitemap walks
  // up to hundreds of upstream list pages); everything else stays uncached
  // until the public projection and its invalidation are designed.
  if (
    response.status === 200 &&
    (context.url.pathname === '/sitemap.xml' || context.url.pathname === '/robots.txt')
  ) {
    response.headers.set('Cache-Control', 'public, max-age=300');
  } else {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
});
