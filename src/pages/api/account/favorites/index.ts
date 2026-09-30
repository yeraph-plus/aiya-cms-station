import type { APIRoute } from 'astro';
import {
  errorCode,
  errorRequestId,
  errorStatus,
  jsonResponse,
  readJsonBody,
  visitorIp,
} from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/account/favorites/: add a post to the viewer's favorites
 * ({postId}); the bearer stays inside the HttpOnly cookie. The answer
 * carries the resulting favorited state, so a stale client converges.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await readJsonBody(Astro.request)) as { postId?: unknown } | null;
  const postId = Number(body?.postId);
  if (!Number.isInteger(postId) || postId < 1) return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(token, ip).addFavorite(postId);
    return jsonResponse({ ok: true, favorited: result.data.favorited });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
