import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * DELETE /api/account/favorites/{postId}/: drop the post from the viewer's
 * favorites; answers with the resulting favorited state.
 */
export const DELETE: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const postId = Number(Astro.params.postId);
  if (!Number.isInteger(postId) || postId < 1) return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(token).removeFavorite(postId);
    return jsonResponse({ ok: true, favorited: result.data.favorited });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
