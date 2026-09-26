import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { serverClient } from '@/lib/core/server';
import { rewriteMediaUrl } from '@/lib/media';

/** GET /api/smilies/: directory-scanned smilies packs for editor pickers
    (public read; items carry the `::code::` token plus the image URL).
    Item URLs arrive WP-absolute (content_url) and are cloaked here — the
    browser bundle has no WP origin (non-public env), so a client-side
    rewrite is a no-op and the picker would hit the WP host directly. */
export const GET: APIRoute = async ({ request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  try {
    const result = await serverClient(ip).smilies();
    return jsonResponse({
      ok: true,
      data: result.data.map((pack) => ({
        ...pack,
        items: pack.items.map((item) => ({ ...item, url: rewriteMediaUrl(item.url) })),
      })),
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
