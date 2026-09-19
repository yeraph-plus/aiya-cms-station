import type { APIRoute } from 'astro';
import { cloakPostSummaryMedia } from '@/lib/media';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { serverClient } from '@/lib/aiya/server';

/**
 * GET /api/content/{id}/related/: shared-term read neighbours (public).
 * SSR renders the first batch; this proxy exists for the island-rendering
 * round and client refreshes, mirroring the feed proxy contract. A caller
 * `number` rides to the backend (whose default 5 and 1–20 band own the
 * semantics) — the proxy never trims locally, or asking for more than the
 * default would silently return fewer rows.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const numberRaw = url.searchParams.get('number');
  const number = numberRaw ? Math.min(20, Math.max(1, Number(numberRaw) || 1)) : undefined;
  try {
    const result = await serverClient().related(id, number === undefined ? {} : { number });
    return jsonResponse({
      ok: true,
      items: result.data.map(cloakPostSummaryMedia),
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
