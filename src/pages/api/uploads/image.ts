import { defineProxy, jsonResponse, uploadLengthStatus } from '@/lib/api-auth';
import { rewriteMediaUrl } from '@/lib/media';

/** Mirrors the backend pic-bed gate (aiya_upload_too_large / _type). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/uploads/image/: community composer upload. Forwards the
 * multipart body to the backend's `/uploads/image` with the cookie bearer,
 * then cloaks the returned WP-absolute URL to `/media/…` so the editor
 * inserts a single-origin src. Size is pre-checked before buffering.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  // formData() buffers the whole body before the field size is known, and a
  // chunked body carries no length at all — gate the declared length up
  // front (islands' fetch always sends one).
  const lengthStatus = uploadLengthStatus(request, MAX_UPLOAD_BYTES + 4096);
  if (lengthStatus !== null) {
    return jsonResponse(
      { ok: false, code: lengthStatus === 413 ? 'aiya_upload_too_large' : 'aiya_invalid_param' },
      lengthStatus,
    );
  }
  let file: File;
  try {
    const form = await request.formData();
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
  const result = await client.uploadImage(file, file.name || 'upload');
  return jsonResponse({ ok: true, url: rewriteMediaUrl(result.url) });
});
