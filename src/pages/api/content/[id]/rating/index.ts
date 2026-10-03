import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/**
 * POST /api/content/{id}/rating/: resource rating write on the 1-10 scale.
 * The wrapper's client carries the session when present so the backend
 * dedupes logged-in raters by id; guests ride the IP+UA hash. The answer
 * carries the folded score + rater count (the display pair) and the
 * per-visitor already flag.
 */
export const POST = defineProxy({}, async ({ client, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await readJsonBody(request)) as { value?: unknown } | null;
  const value = Number(body?.value);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return jsonResponse({ ok: false }, 400);
  }
  const result = await client.rating(id, value);
  return jsonResponse({
    ok: true,
    score: result.data.score,
    count: result.data.count,
    already: result.data.already,
  });
});
