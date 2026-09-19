import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { postsQuerySchema, resourcesQuerySchema } from '@/lib/aiya/contracts';
import { serverClient } from '@/lib/aiya/server';
import { cloakPostSummaryMedia } from '@/lib/media';

/**
 * GET /api/feed/{posts|resources|pages}/: same-origin JSON feed backing the
 * PostLoop island's client-side pagination and taxonomy filtering. The
 * initial page always comes from SSR (routes fetch through serverClient);
 * this endpoint only serves subsequent states, so it re-uses the same
 * query schemas and the same anonymous client. Media URLs are rewritten
 * here — the browser bundle cannot know the WP origin.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const type = params.type ?? '';
  if (type !== 'posts' && type !== 'resources' && type !== 'pages')
    return jsonResponse({ ok: false }, 404);

  const page = Number(url.searchParams.get('page') ?? 1);
  const perPageRaw = url.searchParams.get('perPage');
  const perPage = perPageRaw ? Number(perPageRaw) : undefined;
  const common = {
    page,
    ...(perPage !== undefined ? { perPage } : {}),
    q: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    tag: url.searchParams.get('tag') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
  };

  try {
    const client = serverClient();
    if (type === 'posts' || type === 'pages') {
      const parsed = postsQuerySchema.safeParse({
        ...common,
        author: url.searchParams.get('author') ?? undefined,
      });
      if (!parsed.success) return jsonResponse({ ok: false }, 400);
      const result =
        type === 'posts' ? await client.posts(parsed.data) : await client.pages(parsed.data);
      return jsonResponse({
        ok: true,
        items: result.data.map(cloakPostSummaryMedia),
        pagination: result.meta.pagination,
      });
    }
    const parsed = resourcesQuerySchema.safeParse(common);
    if (!parsed.success) return jsonResponse({ ok: false }, 400);
    const result = await client.resources(parsed.data);
    return jsonResponse({
      ok: true,
      items: result.data.map(cloakPostSummaryMedia),
      pagination: result.meta.pagination,
    });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
