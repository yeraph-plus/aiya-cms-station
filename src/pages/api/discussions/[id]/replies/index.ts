import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { cloakReply } from '@/lib/community';

/** GET /api/discussions/{id}/replies/: public paged reply list; the island
    fetches these lazily when a thread's reply section expands. The session
    rides along so the backend derives real canEdit/canDelete flags — a
    guest-context fetch would strip them and hide the delete affordance. */
export const GET = defineProxy({}, async ({ client, params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const pageNum = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const result = await client.discussionReplies(id, pageNum);
  return jsonResponse({
    ok: true,
    items: result.data.map(cloakReply),
    pagination: result.meta.pagination,
  });
});

/** POST /api/discussions/{id}/replies/: login-only flat reply. */
export const POST = defineProxy({ auth: 'required' }, async ({ client, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await readJsonBody(request)) as { content?: unknown } | null;
  if (!body || typeof body.content !== 'string' || body.content.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const result = await client.addDiscussionReply(id, body.content);
  return jsonResponse({ ok: true, reply: cloakReply(result.data) });
});
