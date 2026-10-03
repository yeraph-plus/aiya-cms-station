import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { rewriteMediaUrl } from '@/lib/media';
import { sanitizeCommentHtml } from '@/lib/content';

/**
 * GET  /api/content/{id}/comments/: public paged list (approved only).
 * POST same path: login-only composer writes; the bearer stays in the
 * HttpOnly cookie. Answers carry front-end status codes, never payloads.
 * Avatar URLs are rewritten here — the browser bundle cannot know the WP
 * origin, so client-side rewriting is a no-op and pages fetched beyond the
 * SSR window would leak the upstream host. The GET rides the anonymous
 * client even with a session: approved rows only, the bearer must not
 * widen the result set.
 */
export const GET = defineProxy({ client: 'server' }, async ({ client, params, url }) => {
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
  const result = await client.comments(id, {
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
});

export const POST = defineProxy({}, async ({ client, token, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);
  // Guests pass through anonymously and the backend's comment_registration
  // switch decides whether they may post (401 when the wall is on).
  const body = (await readJsonBody(request)) as {
    body?: unknown;
    parentId?: unknown;
    authorName?: unknown;
    authorEmail?: unknown;
  } | null;
  if (!body || typeof body.body !== 'string' || body.body.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const result = await client.addComment(id, {
    body: body.body,
    ...(typeof body.parentId === 'number' ? { parentId: body.parentId } : {}),
    // Guest identity rides only for guests — the proxy strips it for
    // session writers instead of trusting the backend to ignore it
    // (defense in depth: identity comes from the session, not the body).
    ...(token
      ? {}
      : {
          ...(typeof body.authorName === 'string' ? { authorName: body.authorName } : {}),
          ...(typeof body.authorEmail === 'string' ? { authorEmail: body.authorEmail } : {}),
        }),
  });
  return jsonResponse({
    ok: true,
    created: result.data.created,
    id: result.data.id,
    status: result.data.status,
  });
});
