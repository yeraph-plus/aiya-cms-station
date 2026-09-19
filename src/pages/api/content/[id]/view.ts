import type { APIRoute } from 'astro';
import { authClient, serverClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';

/**
 * Anonymous view-beacon proxy (`POST /api/content/{id}/view/`). Counted per
 * visitor by the backend (logged-in users by id, guests by IP+UA hash — see
 * the implementation contract for the transitional REMOTE_ADDR caveat).
 * The beacon fires with `keepalive` and ignores failures client-side, so
 * error bodies stay minimal.
 */
export const POST: APIRoute = async (Astro) => {
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ views: null }, 400);
  }

  const token = readSessionToken(Astro.cookies);
  try {
    const result = token ? await authClient(token).view(id) : await serverClient().view(id);
    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse({ views: null, code: errorCode(error) }, errorStatus(error));
  }
};
