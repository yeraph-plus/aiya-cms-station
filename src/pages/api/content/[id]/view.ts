import type { APIRoute } from 'astro';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';
import { errorCode, errorRequestId, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';

/**
 * Anonymous view-beacon proxy (`POST /api/content/{id}/view/`). Counted per
 * visitor by the backend (logged-in users by id, guests by IP+UA hash — see
 * the implementation contract for the transitional REMOTE_ADDR caveat).
 * The beacon fires with `keepalive` and ignores failures client-side, so
 * error bodies stay minimal.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ ok: false }, 400);
  }

  const token = readSessionToken(Astro.cookies);
  try {
    const result = token ? await authClient(token, ip).view(id) : await serverClient(ip).view(id);
    // Only the count crosses; the upstream envelope's meta (requestId,
    // apiVersion) stays server-side like on every other proxy route.
    return jsonResponse({ ok: true, views: result.data.views }, 200);
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
