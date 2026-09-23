import type { APIRoute } from 'astro';
import {
  errorCode,
  errorStatus,
  jsonResponse,
  visitorIp,
  uploadLengthStatus,
} from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

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
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  // formData() buffers the whole body before the field size is known, and a
  // chunked body carries no length at all — gate the declared length up
  // front (islands' fetch always sends one).
  const lengthStatus = uploadLengthStatus(Astro.request, MAX_AVATAR_BYTES + 4096);
  if (lengthStatus !== null) {
    return jsonResponse(
      { ok: false, code: lengthStatus === 413 ? 'aiya_upload_too_large' : 'aiya_invalid_param' },
      lengthStatus,
    );
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
    const result = await authClient(token, ip).uploadAvatar(file, file.name || 'avatar');
    return jsonResponse({ ok: true, user: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

export const DELETE: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const result = await authClient(token, ip).removeAvatar();
    return jsonResponse({ ok: true, user: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
