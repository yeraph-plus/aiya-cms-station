import type { APIContext, APIRoute } from 'astro';
import { AiyaApiError } from '@/lib/core/errors';
import { authClient, clientIpHeader, serverClient } from '@/lib/core/server';
import type { AiyaClient } from '@/lib/core/client';
import { readSessionToken } from '@/lib/core/session';
import { nsfwExcluded } from '@/lib/nsfw';
import { resolveVisitorIp } from '@/lib/visitor-ip';
import { resolveLocale, type Locale } from '@/lib/i18n';
import { ZodError } from 'zod';

/**
 * Server-only helpers for the same-origin /api proxy routes (every endpoint
 * under src/pages/api). Importing lib/core/server pins this module to the
 * Astro server bundle.
 */

/**
 * The visitor address as this deployment resolves it (lib/visitor-ip.ts).
 * Proxies forward it next to the shared secret so the backend's rate
 * limiting, guest dedup and comment IP bind to the real client instead of
 * this server. Null when nothing usable — the request then simply rides
 * without the forwarded header.
 */
export function visitorIp(request: Request, clientAddress: string | null): string | null {
  return resolveVisitorIp(request, clientAddress, clientIpHeader());
}

let cachedLanguage: { value: string | null } | null = null;

/**
 * Locale of the requester: site language for guests (pre-login calls only).
 * The language rides the /site payload, which this proxy cannot otherwise
 * justify fetching on every failed login — one read per process, then the
 * cached value stands (site language changes need a restart to show in
 * these error copies, an acceptable trade on a rate-limited endpoint).
 */
export async function requesterLocale(): Promise<Locale> {
  if (!cachedLanguage) {
    // Cache successes only: pinning a failed read as null would freeze the
    // pre-login error-copy locale at the fallback until restart. A failure
    // leaves the slot open so the next request retries the read.
    try {
      cachedLanguage = { value: (await serverClient().site()).data.language };
    } catch {
      /* default locale below; retried on the next request */
    }
  }
  return resolveLocale({ site: cachedLanguage?.value ?? null });
}

/** Only our own backend statuses pass through; anything else is a 502. */
export function errorStatus(error: unknown): number {
  // Contract schemas throw bare ZodErrors before any upstream call — those
  // are bad requests, not backend failures.
  if (error instanceof ZodError) return 400;
  if (error instanceof AiyaApiError && error.status >= 400 && error.status <= 599) {
    return error.status;
  }
  return 502;
}

/**
 * Machine code from the contract envelope (aiya_*), so islands can resolve
 * front-end copy via the error dictionary. Undefined for non-envelope
 * failures (network/timeout/contract drift).
 */
export function errorRequestId(error: unknown): string | undefined {
  return error instanceof AiyaApiError ? error.requestId : undefined;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof AiyaApiError ? error.code : undefined;
}

/** Upper bound for JSON proxy bodies; nothing here legitimately needs more. */
const MAX_JSON_BYTES = 64 * 1024;

/**
 * Parsed JSON body, or null for anything malformed — including oversized.
 * Reads through a bounded stream so a missing Content-Length (chunked
 * encoding) cannot buffer an unbounded body into memory before any size
 * check: the cap is enforced while reading, not after.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const decoder = new TextDecoder();
  let text = '';
  for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Content-Length gate for multipart uploads: formData() buffers the whole
 * body before the field size is known, and a chunked body carries no
 * length at all — both would defeat a post-hoc check. Returns the failure
 * status (411/413) or null when the declared length is within bounds (the
 * per-field size is still checked after parsing).
 */
export function uploadLengthStatus(request: Request, max: number): number | null {
  const raw = request.headers.get('content-length');
  if (raw === null) return 411;
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0) return 400;
  if (length > max) return 413;
  return null;
}

/**
 * The browsed hostname for session-cookie scoping: the Host header the
 * adapter reflects into request.url (nginx passes $host through). The
 * session cookie's Domain only fits when this host lives inside the
 * site's registrable root — see session.ts resolveScope.
 */
export function requestHost(request: Request): string | undefined {
  try {
    return new URL(request.url).hostname;
  } catch {
    return undefined;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface ProxyHandlerContext {
  /** The full Astro context (params / url / cookies / redirect…). */
  astro: APIContext;
  request: Request;
  url: URL;
  params: APIContext['params'];
  cookies: APIContext['cookies'];
  /** Visitor address resolved once (lib/visitor-ip) — clients embed it so
      the backend's rate limiting and dedup bind to the real visitor. */
  ip: string | null;
  /** Session bearer, null for guests. */
  token: string | null;
  /** Client carrying the visitor's bearer when present (and the NSFW
      exclusion when options.nsfw). */
  client: AiyaClient;
}

export interface ProxyOptions {
  /** Answer 401 `{ok:false}` before the handler when no session cookie. */
  auth?: 'required';
  /** Feed the client the visitor's NSFW soft switch (the PostLoop feed). */
  nsfw?: boolean;
}

/**
 * The /api proxy skeleton: one place resolves the visitor address and the
 * session, guards `auth: 'required'`, builds the client and maps every
 * throw into the wire error shape (`{ok:false, code, requestId}` + status —
 * the contract the islands compile against). The handler returns the
 * success Response and may return early Responses for its own 4xx checks.
 * login/register stay handwritten: they attach front-end error copy and
 * issue the session cookie, neither of which fits this shape.
 */
export function defineProxy(
  options: ProxyOptions,
  handler: (ctx: ProxyHandlerContext) => Promise<Response>,
): APIRoute {
  return async (astro) => {
    const ip = visitorIp(astro.request, astro.clientAddress);
    const token = readSessionToken(astro.cookies);
    if (options.auth === 'required' && !token) {
      return jsonResponse({ ok: false }, 401);
    }
    const excludeNsfw = options.nsfw ? nsfwExcluded(astro.cookies) : undefined;
    const client = token ? authClient(token, ip, excludeNsfw) : serverClient(ip, excludeNsfw);
    try {
      return await handler({
        astro,
        request: astro.request,
        url: astro.url,
        params: astro.params,
        cookies: astro.cookies,
        ip,
        token,
        client,
      });
    } catch (error) {
      return jsonResponse(
        { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
        errorStatus(error),
      );
    }
  };
}
