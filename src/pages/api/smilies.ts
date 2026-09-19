import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { serverClient } from '@/lib/aiya/server';

/** GET /api/smilies/: directory-scanned smilies packs for editor pickers
    (public read; items carry the `::code::` token plus the image URL). */
export const GET: APIRoute = async () => {
  try {
    const result = await serverClient().smilies();
    return jsonResponse({ ok: true, data: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
