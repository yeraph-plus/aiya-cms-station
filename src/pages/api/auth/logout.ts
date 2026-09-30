import type { APIRoute } from 'astro';
import { authClient } from '@/lib/core/server';
import { clearSessionCookie, readSessionToken } from '@/lib/core/session';
import { jsonResponse, visitorIp } from '@/lib/api-auth';

/** Best-effort upstream revocation, then the cookie removal — which is what actually logs out. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  try {
    if (token) await authClient(token, ip).logout();
  } catch {
    // The cookie removal still logs the visitor out locally; the warn is
    // the only trace that the bearer lives on upstream until it expires.
    console.warn('[aiya] logout: upstream token revocation failed');
  }
  clearSessionCookie(Astro.cookies);
  return jsonResponse({ ok: true });
};
