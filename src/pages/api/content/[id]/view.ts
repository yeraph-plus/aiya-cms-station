import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * Anonymous view-beacon proxy (`POST /api/content/{id}/view/`). Counted per
 * visitor by the backend (logged-in users by id, guests by IP+UA hash — see
 * the implementation contract for the transitional REMOTE_ADDR caveat).
 * The beacon fires with `keepalive` and ignores failures client-side, so
 * error bodies stay minimal.
 */
export const POST = defineProxy({}, async ({ client, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const result = await client.view(id);
  // Only the count crosses; the upstream envelope's meta (requestId,
  // apiVersion) stays server-side like on every other proxy route.
  return jsonResponse({ ok: true, views: result.data.views }, 200);
});
