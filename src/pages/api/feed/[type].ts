import { errorCode, errorRequestId, errorStatus, defineProxy, jsonResponse } from '@/lib/api-auth';
import { postsQuerySchema, resourcesQuerySchema } from '@/lib/core/contracts';
import { cloakPostSummaryMedia } from '@/lib/media';
import { isSearchScope, loadSearchPage, normalizeKeyword, type SearchScope } from '@/lib/search';

/**
 * GET /api/feed/{posts|resources|pages|search}/: same-origin JSON feed
 * backing the PostLoop island's client-side pagination and taxonomy
 * filtering. The initial page always comes from SSR (routes fetch through
 * serverClient); this endpoint only serves subsequent states, so it
 * re-uses the same query schemas. Media URLs are rewritten here — the
 * browser bundle cannot know the WP origin.
 *
 * `search` is the same loop over /search's own read (lib/search), so a
 * paged search body never re-implements the scope rules.
 */
export const GET = defineProxy({ nsfw: true }, async ({ client, params, url }) => {
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

  // The feed paginates from the browser, so the visitor's NSFW soft
  // switch and session ride here instead of the URL: the client carries
  // the exclusion flag and — with a session cookie — the viewer's own
  // bearer, matching the SSR page-one read (whose backend override for
  // "always show NSFW" users then applies to later pages too).
  if (kind === 'search') {
    // Search is the one feed whose scope rides the query string: the
    // keyword is a path segment on its page and `type` is the scope the
    // route reads, so the loop carries the same key here.
    const key = normalizeKeyword(url.searchParams.get('q') ?? '');
    const rawScope = url.searchParams.get('type') ?? '';
    const scope: SearchScope = isSearchScope(rawScope) ? rawScope : 'all';
    if (key === '' || !Number.isInteger(page) || page < 1) return jsonResponse({ ok: false }, 400);
    const rawPerPage = Number(url.searchParams.get('perPage'));
    const feedPerPage = Number.isInteger(rawPerPage) && rawPerPage >= 1 ? rawPerPage : undefined;
    const result = await loadSearchPage(client, { key, scope, page, perPage: feedPerPage });
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
});
