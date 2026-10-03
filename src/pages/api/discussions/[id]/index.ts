import type { DiscussionUpdate } from '@/lib/core/contracts';
import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/**
 * PATCH /api/discussions/{id}/: author/admin edits (title/content/type/status).
 * DELETE: author/admin removal — both flags are server-derived upstream.
 */
export const PATCH = defineProxy({ auth: 'required' }, async ({ client, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await readJsonBody(request)) as DiscussionUpdate | null;
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return jsonResponse({ ok: false }, 400);
  }
  await client.updateDiscussion(id, body);
  return jsonResponse({ ok: true });
});

export const DELETE = defineProxy({ auth: 'required' }, async ({ client, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  await client.deleteDiscussion(id);
  return jsonResponse({ ok: true });
});
