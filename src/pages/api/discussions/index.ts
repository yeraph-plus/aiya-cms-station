import { discussionsQuerySchema } from '@/lib/core/contracts';
import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { cloakDiscussion } from '@/lib/community';

/** GET /api/discussions/: public paged feed (board/status-sort/post filters
    ride as query params); items carry text-safe HTML and cloaked media URLs
    so the community island can render client-fetched pages without touching
    the WP host. A caller `perPage` rides through when present — absent
    params stay absent so the backend's default window decides. The session
    rides along so the backend derives real canEdit/canDelete/canReply
    flags — a guest-context fetch would strip them. */
export const GET = defineProxy({}, async ({ client, url }) => {
  const perPageRaw = url.searchParams.get('perPage');
  const postRaw = url.searchParams.get('post');
  const post = postRaw !== null && /^\d+$/.test(postRaw) ? Number(postRaw) : undefined;
  const parsed = discussionsQuerySchema.safeParse({
    board: url.searchParams.get('board') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    page: url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined,
    ...(post !== undefined ? { post } : {}),
    ...(perPageRaw ? { perPage: Number(perPageRaw) } : {}),
  });
  if (!parsed.success) return jsonResponse({ ok: false }, 400);
  const result = await client.discussions(parsed.data);
  return jsonResponse({
    ok: true,
    items: result.data.map(cloakDiscussion),
    pagination: result.meta.pagination,
  });
});

/** POST /api/discussions/: create a thread (login-only, rate limited 5/h). */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as {
    title?: unknown;
    board?: unknown;
    content?: unknown;
    postId?: unknown;
  } | null;
  if (!body || typeof body.title !== 'string' || typeof body.content !== 'string') {
    return jsonResponse({ ok: false }, 400);
  }
  await client.createDiscussion({
    title: body.title,
    board: typeof body.board === 'string' ? body.board : '',
    content: body.content,
    postId: typeof body.postId === 'number' ? body.postId : 0,
  });
  return jsonResponse({ ok: true });
});
