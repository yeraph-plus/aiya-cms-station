import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * Same-origin notification feed proxy. The bearer lives in an HttpOnly
 * cookie, so the browser never touches WP directly; guests get an empty
 * feed (the bell only renders for signed-in visitors anyway).
 */
export const GET: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: true, items: [] });
  try {
    const feed = await authClient(token, ip).notifications();
    return jsonResponse({ ok: true, items: feed.items });
  } catch (error) {
    // Dead session / backend down: the bell degrades to an error note
    // instead of breaking the shell.
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
