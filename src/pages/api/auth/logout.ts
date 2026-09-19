import type { APIRoute } from 'astro';
import { authClient } from '@/lib/aiya/server';
import { clearSessionCookie, readSessionToken } from '@/lib/aiya/session';
import { jsonResponse } from '@/lib/api-auth';

/** Best-effort upstream revocation, then the cookie removal — which is what actually logs out. */
export const POST: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  try {
    if (token) await authClient(token).logout();
  } catch {
    /* already down or already revoked */
  }
  clearSessionCookie(Astro.cookies);
  return jsonResponse({ ok: true });
};
