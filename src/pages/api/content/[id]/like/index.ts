import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * POST /api/content/{id}/like/: public counter write. The session token
 * (when present) rides the wrapper's client so the backend dedupes
 * logged-in visitors by id instead of the IP+UA hash; guests stay
 * anonymous.
 */
export const POST = defineProxy({}, async ({ client, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.like(id);
  return jsonResponse({
    ok: true,
    likes: result.data.likes,
    already: result.data.already,
  });
});
