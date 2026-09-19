import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/** Mirrors the backend's avatar gate (aiya_upload_too_large / _type). */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_MIME_PREFIXES = ['image/'];

/**
 * POST /api/account/avatar/: multipart upload (field name `avatar`, the
 * backend's fixed field). DELETE /api/account/avatar/: back to Gravatar.
 * Both answer with the refreshed /users/me projection. Size/type are
 * pre-checked here so oversized bodies are rejected before formData()
 * buffers the whole upload.
 */
export const POST: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const declared = Astro.request.headers.get('content-length');
  if (declared && Number(declared) > MAX_AVATAR_BYTES + 4096) {
    return jsonResponse({ ok: false, code: 'aiya_upload_too_large' }, 413);
  }
  let file: File;
  try {
    const form = await Astro.request.formData();
    const entry = form.get('avatar');
    if (!(entry instanceof File) || entry.size === 0) return jsonResponse({ ok: false }, 400);
    if (entry.size > MAX_AVATAR_BYTES) {
      return jsonResponse({ ok: false, code: 'aiya_upload_too_large' }, 413);
    }
    if (!AVATAR_MIME_PREFIXES.some((prefix) => entry.type.startsWith(prefix))) {
      return jsonResponse({ ok: false, code: 'aiya_upload_type' }, 415);
    }
    file = entry;
  } catch {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const result = await authClient(token).uploadAvatar(file, file.name || 'avatar');
    return jsonResponse({ ok: true, user: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

export const DELETE: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const result = await authClient(token).removeAvatar();
    return jsonResponse({ ok: true, user: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
