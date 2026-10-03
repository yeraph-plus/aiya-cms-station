import { beforeAll, describe, expect, it, vi } from 'vitest';
import { backend } from '@/lib/core/health';
import { onRequest } from '@/middleware';

// Both the gate probe and the media proxy dial the configured WP origin.
// Tests point it at a dead port: nothing real is contacted, the probe always
// fails fast (connection refused), and the local dev backend that may
// genuinely listen on :8000 can never flip a verdict under the suite.
beforeAll(() => {
  process.env.AIYA_WP_API_URL = 'http://127.0.0.1:9/wp-json/aiya/core/v1/';
});

const ORIGIN = 'https://front.example';
const BASE_CSP = "object-src 'none'; frame-ancestors 'self'; base-uri 'none'";

interface RunInit {
  method?: string;
  accept?: string;
  nextHeaders?: Record<string, string>;
}

/** Drives the real middleware with a minimal APIContext stand-in. */
function run(rawPath: string, init: RunInit = {}) {
  // A `//`-prefixed path must survive: base-resolution would parse it as
  // protocol-relative, while the adapter hands the handler the raw pathname.
  const url = new URL(rawPath.startsWith('//') ? ORIGIN + rawPath : rawPath, ORIGIN);
  const request = new Request(url, {
    method: init.method ?? 'GET',
    headers: init.accept ? { accept: init.accept } : undefined,
  });
  let nextCalls = 0;
  const context = {
    url,
    request,
    clientAddress: '127.0.0.1',
    locals: {},
    redirect: (location: string, status = 302) =>
      new Response(null, { status, headers: { Location: location } }),
  };
  const next = async (): Promise<Response> => {
    nextCalls += 1;
    return new Response('<html>page</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...init.nextHeaders },
    });
  };
  // The real MiddlewareHandler type admits `void` returns; this handler
  // always returns the promise, and the assertion pins that contract.
  const response = onRequest(
    context as unknown as Parameters<typeof onRequest>[0],
    next,
  ) as Promise<Response>;
  return { response, ranNext: () => nextCalls };
}

describe('308 normalization', () => {
  it('slashes page paths and preserves the query', async () => {
    const one = await run('/posts?q=x&tag=y').response;
    expect(one.status).toBe(308);
    expect(one.headers.get('Location')).toBe('/posts/?q=x&tag=y');

    const nested = await run('/posts/page/2').response;
    expect(nested.status).toBe(308);
    expect(nested.headers.get('Location')).toBe('/posts/page/2/');
  });

  it('collapses leading double slashes so the Location stays same-origin', async () => {
    // Deliberately two hops: this branch only collapses; the trailing-slash
    // rule slashes the collapsed path on the bounced request.
    const response = await run('//evil.example/x').response;
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('/evil.example/x');
  });

  it('exempts the API surface, file-like paths and non-GET/HEAD methods', async () => {
    const api = run('/api/feed/posts');
    expect(api.ranNext()).toBe(1);
    expect((await api.response).status).toBe(200);

    const file = run('/robots.txt');
    expect(file.ranNext()).toBe(1);

    const post = run('/posts', { method: 'POST' });
    expect(post.ranNext()).toBe(1);

    // HEAD shares the safe-method branch of GET.
    const head = run('/posts', { method: 'HEAD' });
    expect((await head.response).status).toBe(308);
  });

  it('folds the retired membership route into the account hub', async () => {
    const bare = await run('/membership?sort=x').response;
    expect(bare.status).toBe(308);
    expect(bare.headers.get('Location')).toBe('/profile/me/?sort=x');

    const slashed = await run('/membership/').response;
    expect(slashed.headers.get('Location')).toBe('/profile/me/');
  });

  it('stamps redirects with the security-header baseline', async () => {
    const response = await run('/posts').response;
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('Content-Security-Policy')).toBe(BASE_CSP);
  });
});

describe('media branch', () => {
  it('streams the upstream file and stamps the security-header baseline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('BYTES', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
      ),
    );
    try {
      const { response, ranNext } = run('/media/uploads/a.jpg');
      const media = await response;
      expect(media.status).toBe(200);
      expect(media.headers.get('Content-Type')).toBe('image/jpeg');
      expect(media.headers.get('Cache-Control')).toBe('public, max-age=604800');
      expect(media.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(media.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(media.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(media.headers.get('Content-Security-Policy')).toBe(BASE_CSP);
      expect(ranNext()).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('404s suspicious targets without dialing out', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      // Double-encoded traversal: literal `..` and single-encoded `%2e%2e`
      // are normalized away by the URL constructor before the middleware
      // sees them; the double-encoded form survives and must hit the blocklist.
      const { response } = run('/media/%252e%252e/wp-config.php');
      expect((await response).status).toBe(404);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('site gate', () => {
  it('gates HTML requests while the backend is down', async () => {
    backend.markUnreachable(new Error('test outage'));
    const { response, ranNext } = run('/some/page/', { accept: 'text/html' });
    const gate = await response;
    expect(gate.status).toBe(503);
    expect(gate.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(gate.headers.get('Retry-After')).toBe('30');
    expect(gate.headers.get('Cache-Control')).toBe('private, no-store');
    expect(gate.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(gate.headers.get('Content-Security-Policy')).toBe(BASE_CSP);
    expect(ranNext()).toBe(0);
  });

  it('passes non-HTML clients through to the router even while gated', async () => {
    backend.markUnreachable(new Error('test outage'));
    const { response, ranNext } = run('/some/page/', { accept: 'application/json' });
    expect((await response).status).toBe(200);
    expect(ranNext()).toBe(1);
  });
});

describe('response baseline', () => {
  it('stamps page responses with the security trio and no-store', async () => {
    const response = await run('/api/feed/posts').response;
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('Content-Security-Policy')).toBe(BASE_CSP);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('caches crawler endpoints briefly, but never an empty sitemap', async () => {
    const robots = await run('/robots.txt').response;
    expect(robots.headers.get('Cache-Control')).toBe('public, max-age=300');

    const sitemap = await run('/sitemap.xml').response;
    expect(sitemap.headers.get('Cache-Control')).toBe('public, max-age=300');

    const empty = await run('/sitemap.xml', { nextHeaders: { 'X-Aiya-Sitemap-Empty': '1' } })
      .response;
    expect(empty.headers.get('Cache-Control')).toBe('private, no-store');
    expect(empty.headers.has('X-Aiya-Sitemap-Empty')).toBe(false);
  });
});
