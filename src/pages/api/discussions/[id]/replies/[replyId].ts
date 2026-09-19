import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

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
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
