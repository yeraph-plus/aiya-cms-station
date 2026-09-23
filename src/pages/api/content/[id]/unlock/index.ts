import type { APIRoute } from 'astro';
import { cloakPostDetail } from '@/lib/detail';
import { errorCode, errorStatus, jsonResponse, visitorIp, readJsonBody } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/content/{id}/unlock/: password gate write. The backend plants
 * no cookie — the password rides every request and the SAME response
 * carries the unlocked detail, so this proxy returns the full projected
 * post for the page to swap in client-side. The whole DTO crosses the
 * cloakPostDetail boundary here: swapped content never passed through SSR,
 * so the browser bundle cannot know the upstream host.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await readJsonBody(Astro.request)) as { password?: unknown } | null;
  if (!body || typeof body.password !== 'string' || body.password === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const token = readSessionToken(Astro.cookies);
  try {
    const client = token ? authClient(token, ip) : serverClient(ip);
    const result = await client.unlockPost(id, body.password);
    return jsonResponse({ ok: true, post: cloakPostDetail(result.data) });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
