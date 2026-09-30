import type { APIRoute } from 'astro';
import type { DiscussionUpdate } from '@/lib/core/contracts';
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
 * PATCH /api/discussions/{id}/: author/admin edits (title/content/type/status).
 * DELETE: author/admin removal — both flags are server-derived upstream.
 */
export const PATCH: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await readJsonBody(request)) as DiscussionUpdate | null;
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    await authClient(token, ip).updateDiscussion(id, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};

export const DELETE: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    await authClient(token, ip).deleteDiscussion(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
