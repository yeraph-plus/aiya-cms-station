import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/content/{id}/like/: public counter write. The session token
 * (when present) is forwarded so the backend dedupes logged-in visitors by
 * id instead of the IP+UA hash; guests stay anonymous. Frontend-origin IP
 * means one shared guest bucket — accepted until the trusted-proxy batch
 * lands.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(Astro.cookies);
  try {
    const result = token ? await authClient(token, ip).like(id) : await serverClient(ip).like(id);
    return jsonResponse({
      ok: true,
      likes: result.data.likes,
      already: result.data.already,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
