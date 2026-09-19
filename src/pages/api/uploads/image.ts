import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';
import { rewriteMediaUrl } from '@/lib/media';

/** Mirrors the backend pic-bed gate (aiya_upload_too_large / _type). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/uploads/image/: community composer upload. Forwards the
 * multipart body to the backend's `/uploads/image` with the cookie bearer,
 * then cloaks the returned WP-absolute URL to `/media/…` so the editor
 * inserts a single-origin src. Size is pre-checked before buffering.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const declared = Astro.request.headers.get('content-length');
  if (declared && Number(declared) > MAX_UPLOAD_BYTES + 4096) {
    return jsonResponse({ ok: false, code: 'aiya_upload_too_large' }, 413);
  }
  let file: File;
  try {
    const form = await Astro.request.formData();
    const entry = form.get('image');
    if (!(entry instanceof File) || entry.size === 0) return jsonResponse({ ok: false }, 400);
    if (entry.size > MAX_UPLOAD_BYTES) {
      return jsonResponse({ ok: false, code: 'aiya_upload_too_large' }, 413);
    }
    if (!entry.type.startsWith('image/')) {
      return jsonResponse({ ok: false, code: 'aiya_upload_type' }, 415);
    }
    file = entry;
  } catch {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const result = await authClient(token, ip).uploadImage(file, file.name || 'upload');
    return jsonResponse({ ok: true, url: rewriteMediaUrl(result.url) });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
