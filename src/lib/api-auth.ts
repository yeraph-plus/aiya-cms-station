import { AiyaApiError } from '@/lib/core/errors';
import { clientIpHeader, serverClient } from '@/lib/core/server';
import { resolveVisitorIp } from '@/lib/visitor-ip';
import { resolveLocale, type Locale } from '@/lib/i18n';
import { ZodError } from 'zod';

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

/**
 * Server-only helpers for the /api/auth proxy routes. Importing
 * aiya/server pins this module to the Astro server.
 */

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
    let language: string | null = null;
    try {
      language = (await serverClient().site()).data.language;
    } catch {
      /* default locale below */
    }
    cachedLanguage = { value: language };
  }
  return resolveLocale({ site: cachedLanguage.value });
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

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
