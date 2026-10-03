import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * DELETE /api/account/favorites/{postId}/: drop the post from the viewer's
 * favorites; answers with the resulting favorited state.
 */
export const DELETE = defineProxy({ auth: 'required' }, async ({ client, params }) => {
  const postId = Number(params.postId);
  if (!Number.isInteger(postId) || postId < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.removeFavorite(postId);
  return jsonResponse({ ok: true, favorited: result.data.favorited });
});
