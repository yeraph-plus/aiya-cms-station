import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';
import { cloakReply } from '@/lib/community';

/** GET /api/discussions/{id}/replies/: public paged reply list; the island
    fetches these lazily when a thread's reply section expands. The session
    rides along so the backend derives real canEdit/canDelete flags — a
    guest-context fetch would strip them and hide the delete affordance. */
export const GET: APIRoute = async ({ cookies, params, url, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const pageNum = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  try {
    const token = readSessionToken(cookies);
    const client = token ? authClient(token, ip) : serverClient(ip);
    const result = await client.discussionReplies(id, pageNum);
    return jsonResponse({
      ok: true,
      items: result.data.map(cloakReply),
      pagination: result.meta.pagination,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

/** POST /api/discussions/{id}/replies/: login-only flat reply. */
export const POST: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
  if (!body || typeof body.content !== 'string' || body.content.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const result = await authClient(token, ip).addDiscussionReply(id, body.content);
    return jsonResponse({ ok: true, reply: cloakReply(result.data) });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
