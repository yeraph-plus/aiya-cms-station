import type { APIRoute } from 'astro';
import { cloakPostSummaryMedia, rewriteMediaUrl } from '@/lib/media';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * POST /api/content/{id}/unlock/: password gate write. The backend plants
 * no cookie — the password rides every request and the SAME response
 * carries the unlocked detail, so this proxy returns the full projected
 * post for the page to swap in client-side. The media URLs are rewritten
 * here: swapped HTML never passed through SSR, so the browser bundle
 * cannot know the upstream host.
 */
export const POST: APIRoute = async (Astro) => {
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const body = (await Astro.request.json().catch(() => null)) as { password?: unknown } | null;
  if (!body || typeof body.password !== 'string' || body.password === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const token = readSessionToken(Astro.cookies);
  try {
    const client = token ? authClient(token) : serverClient();
    const result = await client.unlockPost(id, body.password);
    return jsonResponse({
      ok: true,
      post: {
        ...result.data,
        featured: result.data.featured
          ? { ...result.data.featured, url: rewriteMediaUrl(result.data.featured.url) }
          : null,
        content: { ...result.data.content },
        previous: result.data.previous ? cloakPostSummaryMedia(result.data.previous) : null,
        next: result.data.next ? cloakPostSummaryMedia(result.data.next) : null,
      },
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
