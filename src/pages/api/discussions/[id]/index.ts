import type { APIRoute } from 'astro';
import type { DiscussionUpdate } from '@/lib/aiya/contracts';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * PATCH /api/discussions/{id}/: author/admin edits (title/content/type/status).
 * DELETE: author/admin removal — both flags are server-derived upstream.
 */
export const PATCH: APIRoute = async ({ cookies, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await request.json().catch(() => null)) as DiscussionUpdate | null;
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    await authClient(token).updateDiscussion(id, body);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    await authClient(token).deleteDiscussion(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
