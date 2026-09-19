import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * POST /api/content/{id}/rating/: resource rating write on the 1-10 scale.
 * Session token forwarded when present so the backend dedupes logged-in
 * raters by id; guests ride the IP+UA hash. The answer carries the folded
 * score + rater count (the display pair) and the per-visitor already flag.
 */
export const POST: APIRoute = async (Astro) => {
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await Astro.request.json().catch(() => null)) as { value?: unknown } | null;
  const value = Number(body?.value);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return jsonResponse({ ok: false }, 400);
  }
  const token = readSessionToken(Astro.cookies);
  try {
    const result = token
      ? await authClient(token).rating(id, value)
      : await serverClient().rating(id, value);
    return jsonResponse({
      ok: true,
      score: result.data.score,
      count: result.data.count,
      already: result.data.already,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
