import type { APIRoute } from 'astro';
import type { DiscussionReplyUpdate } from '@/lib/core/contracts';
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
 * PATCH /api/discussions/{id}/replies/{replyId}/: reply author edits the
 * body. DELETE: reply author or admin — both flags are server-derived
 * upstream. The backend route exists and this proxy mirrors it, but the
 * reply contract does not project a `canEdit` flag yet, so no island can
 * render the affordance — pending a contract addition, not a dead face.
 */
export const PATCH: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  const replyId = Number(params.replyId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(replyId) || replyId < 1) {
    return jsonResponse({ ok: false }, 400);
  }
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await readJsonBody(request)) as DiscussionReplyUpdate | null;
  if (!body || typeof body.content !== 'string' || body.content.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    await authClient(token, ip).updateDiscussionReply(id, replyId, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};

/** DELETE /api/discussions/{id}/replies/{replyId}/: reply author or admin. */
export const DELETE: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  const replyId = Number(params.replyId);
  if (!Number.isInteger(id) || id < 1 || !Number.isInteger(replyId) || replyId < 1) {
    return jsonResponse({ ok: false }, 400);
  }
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    await authClient(token, ip).deleteDiscussionReply(id, replyId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
