import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiyaClient } from '@/lib/core/client';
import { AiyaApiError } from '@/lib/core/errors';

const BASE = 'https://wp.example.com/wp-json/aiya/core/v1/';
const META = { apiVersion: '1', requestId: 'abcd1234' };
const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function clientWith(
  handler: (request: Request, init?: RequestInit) => Promise<Response>,
  options = {},
) {
  const requests: Array<{ url: string; method: string; body: string | null; headers: Headers }> =
    [];
  const client = createAiyaClient({
    baseUrl: BASE,
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push({
        url: request.url,
        method: request.method,
        body: request.body ? await request.text() : null,
        headers: request.headers,
      });
      return handler(request, init);
    },
    allowLocalHttp: false,
    ...options,
  });
  return { client, requests };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const SITE_A = {
  name: 'A',
  description: '',
  language: 'zh_CN',
  timezone: 'UTC',
  favicon: null,
  banner: null,
  registrationOpen: true,
  comments: {
    requireNameEmail: true,
    commentMaxLinks: 2,
    moderation: false,
    previouslyApproved: true,
    threadComments: true,
    threadCommentsDepth: 5,
    pageComments: false,
    commentsPerPage: 50,
    defaultCommentsPage: 'newest',
    commentOrder: 'asc',
    commentRegistration: true,
  },
  defaults: { colorMode: 'system', thumb: null, emptyImage: null, theme: { primary: '#e94f69' }, seoKeywords: '', seoDescription: '', gaId: '' },
  footer: { links: [], hitokoto: false },
  blocks: { primary: [], secondary: [], adsTop: [], adsBottom: [], carousel: [] },
};
const okSite = () => okJson({ data: SITE_A, meta: META });

describe('transport security', () => {
  it('sends the visitor bearer when present', async () => {
    const { client, requests } = clientWith(async () => okSite(), {
      bearer: '12.abcdefghijklmnop',
    });
    await client.site();
    expect(requests[0].headers.get('Authorization')).toBe('Bearer 12.abcdefghijklmnop');
  });

  it('reads content anonymously: no machine credential exists', async () => {
    const { client, requests } = clientWith(async () => okSite());
    await client.site();
    expect(requests[0].headers.get('Authorization')).toBeNull();
  });

  it('rejects non-contract base URLs and credential-bearing hosts', () => {
    expect(() => createAiyaClient({ baseUrl: 'https://wp.example.com/wp-json/' })).toThrow(
      AiyaApiError,
    );
    expect(() =>
      createAiyaClient({ baseUrl: 'http://wp.example.com/wp-json/aiya/core/v1/' }),
    ).toThrow(AiyaApiError);
    expect(() =>
      createAiyaClient({ baseUrl: 'https://user:pw@wp.example.com/wp-json/aiya/core/v1/' }),
    ).toThrow(AiyaApiError);
  });
});

describe('proxy bridge headers', () => {
  it('sends the secret and the resolved visitor address when configured', async () => {
    const { client, requests } = clientWith(async () => okSite(), {
      proxySecret: 'bridge-secret',
      clientIp: '203.0.113.7',
    });
    await client.site();
    expect(requests[0].headers.get('X-Aiya-Proxy-Secret')).toBe('bridge-secret');
    expect(requests[0].headers.get('X-Forwarded-For')).toBe('203.0.113.7');
  });

  it('leaves the bridge headers off by default and drops malformed addresses', async () => {
    const { client, requests } = clientWith(async () => okSite(), {
      clientIp: 'not an ip\r\nX-Evil: 1',
    });
    await client.site();
    expect(requests[0].headers.get('X-Aiya-Proxy-Secret')).toBeNull();
    expect(requests[0].headers.get('X-Forwarded-For')).toBeNull();
  });
});

describe('reads and writes', () => {
  it('serializes list queries onto the fixed path', async () => {
    const { client, requests } = clientWith(async () =>
      okJson({
        data: [],
        meta: {
          ...META,
          pagination: {
            page: 2,
            perPage: 6,
            totalItems: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: true,
          },
        },
      }),
    );
    await client.posts({ page: 2, perPage: 6, q: 'a b' });
    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/wp-json/aiya/core/v1/posts');
    expect(url.searchParams.get('q')).toBe('a b');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('routes writes through the allowlist with the right method and body', async () => {
    const { client, requests } = clientWith(
      async (request) => {
        if (request.url.endsWith('users/me/profile'))
          return okJson({
            data: {
              id: 1,
              username: 'u',
              slug: 'u',
              nickname: 'n',
              email: 'a@b.co',
              url: '',
              description: '',
              locale: 'zh_CN',
              registeredAt: '2026-01-01T00:00:00+08:00',
              role: 'subscriber',
              avatar: { url: '', thumbUrl: '' },
              stats: { favorites: 0, contributions: 0, followers: 0 },
            },
            meta: META,
          });
        if (request.url.endsWith('discussions/5'))
          return okJson({
            data: {
              id: 5,
              url: '/community/5/',
              title: 't',
              type: 'question',
              status: 'open',
              board: null,
              tags: [],
              images: [],
              author: { id: 1, slug: 'a', name: 'a', avatar: null },
              postRef: null,
              lastReplyAt: '',
              publishedAt: '2026-01-01T00:00:00+08:00',
              canEdit: true,
              canDelete: true,
              canReply: true,
              contentHtml: '<p>x</p>',
              replies: [],
              content: { format: 'html', html: '<p>x</p>' },
            },
            meta: META,
          });
        return okJson({ data: { deleted: true }, meta: META });
      },
      { bearer: '12.abcdefghijklmnop' },
    );

    await client.updateProfile({ nickname: '新名字' });
    expect(requests[0].method).toBe('PATCH');
    expect(JSON.parse(requests[0].body!)).toEqual({ nickname: '新名字' });

    await client.updateDiscussion(5, { status: 'closed' });
    expect(requests[1].method).toBe('PATCH');
    expect(new URL(requests[1].url).pathname).toBe('/wp-json/aiya/core/v1/discussions/5');

    await client.deleteDiscussionReply(5, 9);
    expect(requests[2].method).toBe('DELETE');
    expect(requests[2].body).toBeNull();
  });

  it('refuses invalid resource ids and out-of-range values before any fetch', () => {
    const { client, requests } = clientWith(async () => okJson({ data: {}, meta: META }));
    expect(() => client.post('')).toThrow(AiyaApiError);
    expect(() => client.post('a/b')).toThrow(AiyaApiError);
    expect(() => client.rating(3, 11)).toThrow();
    expect(() => client.profile('Not_A_Slug')).toThrow(AiyaApiError);
    expect(requests).toHaveLength(0);
  });
});

describe('failure semantics', () => {
  it('maps contract drift to a contract error without leaking payload text', async () => {
    const { client } = clientWith(async () =>
      okJson({ data: { unexpected: 'shape' }, meta: META }),
    );
    const error = await client.site().catch((e) => e);
    expect(error).toBeInstanceOf(AiyaApiError);
    expect((error as AiyaApiError).kind).toBe('contract');
    expect((error as AiyaApiError).message).not.toContain('unexpected');
  });

  it('keeps only status, requestId and machine code from HTTP errors', async () => {
    const { client } = clientWith(async () =>
      okJson(
        {
          error: { code: 'aiya_not_found', message: 'SECRET UPSTREAM TEXT', status: 404 },
          meta: META,
        },
        404,
      ),
    );
    const error = await client.post('hello-world').catch((e) => e);
    expect(error).toBeInstanceOf(AiyaApiError);
    expect((error as AiyaApiError).kind).toBe('http');
    expect((error as AiyaApiError).status).toBe(404);
    expect((error as AiyaApiError).code).toBe('aiya_not_found');
    expect((error as AiyaApiError).requestId).toBe('abcd1234');
    expect((error as AiyaApiError).message).not.toContain('SECRET');
  });

  it('times out against a stalled upstream', async () => {
    const { client } = clientWith(
      (_request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      { timeoutMs: 20 },
    );
    const error = await client.site().catch((e) => e);
    expect((error as AiyaApiError).kind).toBe('timeout');
    expect((error as AiyaApiError).status).toBe(504);
  });
});
