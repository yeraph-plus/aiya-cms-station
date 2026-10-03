import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { cloakPostDetail } from '@/lib/detail';

/**
 * POST /api/content/{id}/unlock/: password gate write. The backend plants
 * no cookie — the password rides every request and the SAME response
 * carries the unlocked detail, so this proxy returns the full projected
 * post for the page to swap in client-side. The whole DTO crosses the
 * cloakPostDetail boundary here: swapped content never passed through SSR,
 * so the browser bundle cannot know the upstream host.
 */
export const POST = defineProxy({}, async ({ client, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await readJsonBody(request)) as { password?: unknown } | null;
  if (!body || typeof body.password !== 'string' || body.password === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const result = await client.unlockPost(id, body.password);
  return jsonResponse({ ok: true, post: cloakPostDetail(result.data) });
});
