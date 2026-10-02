import type { APIRoute } from 'astro';
import { authClient } from '@/lib/core/server';
import {
  clearSessionCookie,
  legacySessionDeleteHeader,
  readSessionToken,
} from '@/lib/core/session';
import { jsonResponse, requestHost, visitorIp } from '@/lib/api-auth';

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
  // Both shapes: the domain-scoped cookie (via AstroCookies) and the legacy
  // host-only one (via the appended header) — clearing only one leaves the
  // session alive on the other scope.
  clearSessionCookie(Astro.cookies, requestHost(Astro.request));
  const response = jsonResponse({ ok: true });
  response.headers.append('set-cookie', legacySessionDeleteHeader());
  return response;
};
