import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/**
 * POST /api/account/favorites/: add a post to the viewer's favorites
 * ({postId}); the bearer stays inside the HttpOnly cookie. The answer
 * carries the resulting favorited state, so a stale client converges.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as { postId?: unknown } | null;
  const postId = Number(body?.postId);
  if (!Number.isInteger(postId) || postId < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.addFavorite(postId);
  return jsonResponse({ ok: true, favorited: result.data.favorited });
});
