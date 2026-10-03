import { defineProxy, jsonResponse } from '@/lib/api-auth';
import { rewriteMediaUrl } from '@/lib/media';

/** GET /api/smilies/: directory-scanned smilies packs for editor pickers
    (public read; items carry the `::code::` token plus the image URL).
    Item URLs arrive WP-absolute (content_url) and are cloaked here — the
    browser bundle has no WP origin (non-public env), so a client-side
    rewrite is a no-op and the picker would hit the WP host directly. */
export const GET = defineProxy({}, async ({ client }) => {
  const result = await client.smilies();
  return jsonResponse({
    ok: true,
    data: result.data.map((pack) => ({
      ...pack,
      items: pack.items.map((item) => ({ ...item, url: rewriteMediaUrl(item.url) })),
    })),
  });
});
