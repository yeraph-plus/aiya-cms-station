import { AiyaApiError } from '@/lib/aiya/errors';
import { serverClient } from '@/lib/aiya/server';
import { resolveLocale, type Locale } from '@/lib/i18n';
import { ZodError } from 'zod';

/**
 * Server-only helpers for the /api/auth proxy routes. Importing
 * aiya/server pins this module to the Astro server.
 */

/** Locale of the requester: site language for guests (pre-login calls only). */
export async function requesterLocale(): Promise<Locale> {
  let language: string | null = null;
  try {
    language = (await serverClient().site()).data.language;
  } catch {
    /* default locale below */
  }
  return resolveLocale({ site: language });
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

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
