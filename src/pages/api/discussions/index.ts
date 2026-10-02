import type { APIRoute } from 'astro';
import {
  errorCode,
  errorRequestId,
  errorStatus,
  jsonResponse,
  readJsonBody,
  visitorIp,
} from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';
import { cloakDiscussion } from '@/lib/community';
import { discussionsQuerySchema } from '@/lib/core/contracts';

/** GET /api/discussions/: public paged feed (board/status-sort/post filters
    ride as query params); items carry text-safe HTML and cloaked media URLs
    so the community island can render client-fetched pages without touching
    the WP host. A caller `perPage` rides through when present — absent
    params stay absent so the backend's default window decides. */
export const GET: APIRoute = async ({ url, cookies, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
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
  try {
    // Forward the session so the backend derives real canEdit/canDelete/
    // canReply flags — a guest-context fetch would strip them.
    const token = readSessionToken(cookies);
    const client = token ? authClient(token, ip) : serverClient(ip);
    const result = await client.discussions(parsed.data);
    return jsonResponse({
      ok: true,
      items: result.data.map(cloakDiscussion),
      pagination: result.meta.pagination,
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};

/** POST /api/discussions/: create a thread (login-only, rate limited 5/h). */
export const POST: APIRoute = async ({ cookies, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = (await readJsonBody(request)) as {
    title?: unknown;
    board?: unknown;
    content?: unknown;
    postId?: unknown;
  } | null;
  if (!body || typeof body.title !== 'string' || typeof body.content !== 'string') {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const result = await authClient(token, ip).createDiscussion({
      title: body.title,
      board: typeof body.board === 'string' ? body.board : '',
      content: body.content,
      postId: typeof body.postId === 'number' ? body.postId : 0,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
