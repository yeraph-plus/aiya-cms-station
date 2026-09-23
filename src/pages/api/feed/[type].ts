import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { postsQuerySchema, resourcesQuerySchema } from '@/lib/core/contracts';
import { serverClient } from '@/lib/core/server';
import { cloakPostSummaryMedia } from '@/lib/media';
import {
  isSearchScope,
  loadSearchPage,
  normalizeKeyword,
  type SearchScope,
} from '@/lib/search';

/**
 * GET /api/feed/{posts|resources|pages|search}/: same-origin JSON feed
 * backing the PostLoop island's client-side pagination and taxonomy
 * filtering. The initial page always comes from SSR (routes fetch through
 * serverClient); this endpoint only serves subsequent states, so it
 * re-uses the same query schemas and the same anonymous client. Media URLs
 * are rewritten here — the browser bundle cannot know the WP origin.
 *
 * `search` is the same loop over /search's own read (lib/search), so a
 * paged search body never re-implements the scope rules.
 */
export const GET: APIRoute = async ({ params, url, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const kind = params.type ?? '';
  if (kind !== 'posts' && kind !== 'resources' && kind !== 'pages' && kind !== 'search')
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
    const client = serverClient(ip);
    if (kind === 'search') {
      // Search is the one feed whose scope rides the query string: the
      // keyword is a path segment on its page and `type` is the scope the
      // route reads, so the loop carries the same key here.
      const key = normalizeKeyword(url.searchParams.get('q') ?? '');
      const rawScope = url.searchParams.get('type') ?? '';
      const scope: SearchScope = isSearchScope(rawScope) ? rawScope : 'all';
      if (key === '' || !Number.isInteger(page) || page < 1)
        return jsonResponse({ ok: false }, 400);
      const result = await loadSearchPage(client, { key, scope, page });
      return jsonResponse({
        ok: true,
        items: result.items.map(cloakPostSummaryMedia),
        pagination: result.pagination,
      });
    }
    if (kind === 'posts' || kind === 'pages') {
      const parsed = postsQuerySchema.safeParse({
        ...common,
        author: url.searchParams.get('author') ?? undefined,
      });
      if (!parsed.success) return jsonResponse({ ok: false }, 400);
      const result =
        kind === 'posts' ? await client.posts(parsed.data) : await client.pages(parsed.data);
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
