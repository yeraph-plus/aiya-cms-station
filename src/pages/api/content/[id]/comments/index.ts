import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';
import { rewriteMediaUrl } from '@/lib/media';
import { sanitizeCommentHtml } from '@/lib/content';

/**
 * GET  /api/content/{id}/comments/: public paged list (approved only).
 * POST same path: login-only composer writes; the bearer stays in the
 * HttpOnly cookie. Answers carry front-end status codes, never payloads.
 * Avatar URLs are rewritten here — the browser bundle cannot know the WP
 * origin, so client-side rewriting is a no-op and pages fetched beyond the
 * SSR window would leak the upstream host.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  const pageNum = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  // Size and window direction ride only when the caller asked: absent
  // params stay absent so the backend's site-setting defaults decide
  // (the same rule the /api/feed proxies follow).
  const perPageRaw = url.searchParams.get('perPage');
  const perPage = perPageRaw ? Math.min(100, Math.max(1, Number(perPageRaw) || 1)) : undefined;
  const orderRaw = url.searchParams.get('order');
  const order = orderRaw === 'desc' || orderRaw === 'asc' ? orderRaw : undefined;
  try {
    const result = await serverClient().comments(id, {
      page: pageNum,
      ...(perPage !== undefined ? { perPage } : {}),
      ...(order !== undefined ? { order } : {}),
    });
    return jsonResponse({
      ok: true,
      items: result.data.map((item) => ({
        ...item,
        author: {
          ...item.author,
          avatar: item.author.avatar ? rewriteMediaUrl(item.author.avatar) : null,
        },
        // Body HTML is sanitized here, not in the browser: pages fetched
        // beyond the SSR window cannot rewrite WP-origin smilies srcs (the
        // client-side pass stays as defense in depth; it is idempotent).
        bodyHtml: sanitizeCommentHtml(item.bodyHtml),
      })),
      pagination: result.meta.pagination,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

export const POST: APIRoute = async ({ cookies, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  // The bearer upgrades the write to a session identity when present;
  // guests pass through anonymously and the backend's comment_registration
  // switch decides whether they may post (401 when the wall is on).
  const token = readSessionToken(cookies);
  const body = (await request.json().catch(() => null)) as {
    body?: unknown;
    parentId?: unknown;
    authorName?: unknown;
    authorEmail?: unknown;
  } | null;
  if (!body || typeof body.body !== 'string' || body.body.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const client = token ? authClient(token) : serverClient();
    const result = await client.addComment(id, {
      body: body.body,
      ...(typeof body.parentId === 'number' ? { parentId: body.parentId } : {}),
      // Guest identity rides only for guests; the backend ignores it for
      // session writers. Without a cookie this proxy 401s before anything.
      ...(typeof body.authorName === 'string' ? { authorName: body.authorName } : {}),
      ...(typeof body.authorEmail === 'string' ? { authorEmail: body.authorEmail } : {}),
    });
    return jsonResponse({
      ok: true,
      created: result.data.created,
      id: result.data.id,
      status: result.data.status,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
