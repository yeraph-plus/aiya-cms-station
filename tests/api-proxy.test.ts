import { beforeAll, describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AiyaApiError } from '@/lib/core/errors';
import {
  defineProxy,
  errorStatus,
  jsonResponse,
  readJsonBody,
  uploadLengthStatus,
  type ProxyHandlerContext,
} from '@/lib/api-auth';

// The wrapper constructs a real AiyaClient per request; point it at a dead
// loopback origin so construction passes the transport checks while the
// handlers under test never dial anything.
beforeAll(() => {
  process.env.AIYA_WP_API_URL = 'http://127.0.0.1:9/wp-json/aiya/core/v1/';
  process.env.AIYA_ALLOW_LOCAL_HTTP = 'true';
});

const ORIGIN = 'https://front.example';
const SESSION_COOKIE = 'aiya_session';
/** Passes the session token whitelist (`id.secret`, secret ≥ 16 alnum). */
const TOKEN = '123.abcdefghijklmnopqrstuvwxyz';

/** Drives a defineProxy route with a minimal APIContext stand-in. */
function run(
  handler: (ctx: ProxyHandlerContext) => Promise<Response>,
  init: { path?: string; session?: boolean; options?: Parameters<typeof defineProxy>[0] } = {},
) {
  const url = new URL(init.path ?? '/api/example/', ORIGIN);
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
  if (init.session) headers.set('cookie', `${SESSION_COOKIE}=${TOKEN}`);
  const request = new Request(url, { headers });
  let handlerCalls = 0;
  const wrapped = async (ctx: ProxyHandlerContext) => {
    handlerCalls += 1;
    return handler(ctx);
  };
  const route = defineProxy(init.options ?? {}, wrapped);
  const astro = {
    request,
    url,
    params: {},
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE && init.session ? { value: TOKEN } : undefined,
    },
    clientAddress: '127.0.0.1',
  };
  const response = (route as (ctx: object) => Promise<Response>)(
    astro as unknown as Parameters<typeof route>[0],
  );
  return { response, ranHandler: () => handlerCalls };
}

describe('defineProxy skeleton', () => {
  it('resolves the visitor address and the guest session into the handler', async () => {
    const { response, ranHandler } = run(async (ctx) => {
      // No AIYA_CLIENT_IP_HEADER configured: the XFF header is NOT trusted
      // and the socket address stands (the trusted-header contract).
      expect(ctx.ip).toBe('127.0.0.1');
      expect(ctx.token).toBeNull();
      return jsonResponse({ ok: true });
    });
    expect((await response).status).toBe(200);
    expect(ranHandler()).toBe(1);
  });

  it('answers 401 before the handler when auth is required and no session rides', async () => {
    const { response, ranHandler } = run(
      async () => {
        throw new Error('handler must not run');
      },
      { options: { auth: 'required' } },
    );
    const settled = await response;
    const body = (await settled.json()) as { ok?: boolean };
    expect(body.ok).toBe(false);
    expect(settled.status).toBe(401);
    expect(ranHandler()).toBe(0);
  });

  it('hands the session bearer to the handler when the cookie rides', async () => {
    const { response, ranHandler } = run(
      async (ctx) => {
        expect(ctx.token).toBe(TOKEN);
        return jsonResponse({ ok: true });
      },
      { session: true, options: { auth: 'required' } },
    );
    expect((await response).status).toBe(200);
    expect(ranHandler()).toBe(1);
  });

  it('maps thrown AiyaApiErrors into the wire error shape', async () => {
    const { response } = run(async () => {
      throw new AiyaApiError('http', 404, 'req123', 'aiya_not_found');
    });
    const settled = await response;
    expect(settled.status).toBe(404);
    expect(await settled.json()).toEqual({
      ok: false,
      code: 'aiya_not_found',
      requestId: 'req123',
    });
  });

  it('maps contract-schema ZodErrors to 400 and unknown failures to 502', async () => {
    const zod = run(async () => {
      throw new ZodError([]);
    });
    const zodResponse = await zod.response;
    expect(zodResponse.status).toBe(400);
    expect(await zodResponse.json()).toEqual({
      ok: false,
      code: undefined,
      requestId: undefined,
    });

    const opaque = run(async () => {
      throw new Error('boom');
    });
    const opaqueResponse = await opaque.response;
    expect(opaqueResponse.status).toBe(502);
    expect(await opaqueResponse.json()).toEqual({
      ok: false,
      code: undefined,
      requestId: undefined,
    });
  });

  it('passes the handler’s own early 4xx responses through untouched', async () => {
    const { response, ranHandler } = run(async () => jsonResponse({ ok: false }, 400));
    expect((await response).status).toBe(400);
    expect(ranHandler()).toBe(1);
  });
});

describe('api-auth assembly helpers', () => {
  it('errorStatus passes only real backend statuses through, 502 otherwise', () => {
    expect(errorStatus(new AiyaApiError('http', 404, 'r', 'aiya_not_found'))).toBe(404);
    expect(errorStatus(new AiyaApiError('http', 500))).toBe(500);
    expect(errorStatus(new AiyaApiError('network'))).toBe(502);
    expect(errorStatus(new AiyaApiError('timeout'))).toBe(502);
    expect(errorStatus(new AiyaApiError('contract'))).toBe(502);
    expect(errorStatus(new AiyaApiError('http', 399))).toBe(502);
    expect(errorStatus(new AiyaApiError('http', 600))).toBe(502);
    expect(errorStatus(new Error('boom'))).toBe(502);
  });

  it('readJsonBody parses bounded JSON and returns null on oversize/malformed', async () => {
    const request = (body: string | null, chunked = false) =>
      new Request('https://x/', {
        method: 'POST',
        headers: chunked ? {} : { 'content-length': String(body?.length ?? 0) },
        body,
        duplex: 'half',
      } as RequestInit);
    expect(await readJsonBody(request(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
    expect(await readJsonBody(request('{broken', true))).toBeNull();
    expect(await readJsonBody(request('x'.repeat(64 * 1024 + 1), true))).toBeNull();
    expect(await readJsonBody(new Request('https://x/', { method: 'GET' }))).toBeNull();
  });

  it('uploadLengthStatus gates missing, malformed and oversized lengths', () => {
    const req = (length?: string) =>
      new Request('https://x/', {
        method: 'POST',
        headers: length === undefined ? {} : { 'content-length': length },
      });
    expect(uploadLengthStatus(req('100'), 200)).toBeNull();
    expect(uploadLengthStatus(req(), 200)).toBe(411);
    expect(uploadLengthStatus(req('abc'), 200)).toBe(400);
    expect(uploadLengthStatus(req('-1'), 200)).toBe(400);
    expect(uploadLengthStatus(req('201'), 200)).toBe(413);
  });
});
