import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * Same-origin notification feed proxy. The bearer lives in an HttpOnly
 * cookie, so the browser never touches WP directly; guests get an empty
 * feed (the bell only renders for signed-in visitors anyway).
 */
export const GET: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: true, items: [] });
  try {
    const feed = await authClient(token).notifications();
    return jsonResponse({ ok: true, items: feed.data.items });
  } catch (error) {
    // Dead session / backend down: the bell degrades to an error note
    // instead of breaking the shell.
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
