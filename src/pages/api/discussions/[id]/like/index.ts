import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * POST /api/discussions/{id}/like/ and DELETE — the thread like toggle.
 * Login-only upstream; a duplicate like is the idempotent "already" path
 * that answers the materialized count with the viewer's resulting state,
 * and closed threads refuse with 409.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.discussionLike(id, 'like');
  return jsonResponse({
    ok: true,
    likes: result.data.likes,
    viewerLiked: result.data.viewerLiked,
  });
});

export const DELETE = defineProxy({ auth: 'required' }, async ({ client, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.discussionLike(id, 'unlike');
  return jsonResponse({
    ok: true,
    likes: result.data.likes,
    viewerLiked: result.data.viewerLiked,
  });
});
