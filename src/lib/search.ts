import type { AiyaClient } from '@/lib/core/client';
import type { Pagination, PostSummary, SearchType } from '@/lib/core/contracts';

/**
 * Header search (`/search/{key}/`): the keyword is the route's path segment
 * and the scope is its `type` query param. Shared by the header island (it
 * needs the href rule), the Astro routes and the feed endpoint, so the three
 * cannot drift. Search stays SSR — the path shape is about shareable links
 * and deep-linked pagination, not about prerendering.
 */

/** Scopes the box offers: the endpoint's own `type` enum plus `all`, which
    is the front end's union mode and never reaches the wire. */
export type { SearchType };
export type SearchScope = 'all' | SearchType;

/** Round-robin order of the union read. */
export const SEARCH_TYPES: readonly SearchType[] = ['post', 'page', 'resource'];

export const SEARCH_SCOPES: readonly SearchScope[] = ['all', ...SEARCH_TYPES];

/** Per-type page size, pinned so SSR, the feed endpoint and the island all
    read the same window (the backend's own default is 10, its cap 50). */
export const SEARCH_PAGE_SIZE = 10;

/** The endpoint's own keyword limit. */
const MAX_KEYWORD = 100;

export function isSearchScope(value: string): value is SearchScope {
  return (SEARCH_SCOPES as readonly string[]).includes(value);
}

/** Routed key → searchable keyword: trimmed and length-capped. An empty
    result means "no keyword" — the bare route sends the visitor home. */
export function normalizeKeyword(raw: string): string {
  return raw.trim().slice(0, MAX_KEYWORD);
}

/** Canonical path of a search page; the key rides the path so a result set
    is a real address (encoded, since keywords carry spaces and CJK). */
export function searchPath(key: string, page = 1): string {
  const base = `/search/${encodeURIComponent(key)}/`;
  return page > 1 ? `${base}page/${page}/` : base;
}

/** The same path with the loop's "{page}" slot, for its FeedRoute prop. */
export function searchPagePattern(key: string): string {
  return `${searchPath(key)}page/{page}/`;
}

/** Where the header box sends the visitor: page one of the chosen scope. */
export function searchHref(key: string, scope: SearchScope): string {
  const path = searchPath(key);
  return scope === 'all' ? path : `${path}?type=${scope}`;
}

/** Address-bar seed for the header search boxes: on /search/{key}/ the box
    mirrors the results already on screen (keyword from the path segment,
    scope from ?type=), so the SSR markup is correct and nothing has to be
    filled in after hydration. Both shells fed this from copy-pasted
    frontmatter before. */
export function searchSeed(
  pathname: string,
  scopeParam: string,
): { keyword: string; scope: SearchScope } {
  const segments = pathname.split('/').filter(Boolean);
  const routedKey = segments[0] === 'search' && segments[1] ? segments[1] : '';
  let decoded = '';
  try {
    decoded = decodeURIComponent(routedKey);
  } catch {
    decoded = '';
  }
  return {
    keyword: normalizeKeyword(decoded),
    scope: isSearchScope(scopeParam) ? scopeParam : 'all',
  };
}

/** The slice of Pagination the loop consumes (and what the routes need for
    the over-range check). The union mode has no honest totalItems — "page N"
    means round N of every type — so only these four are ever synthesized. */
export type SearchPagination = Pick<Pagination, 'page' | 'totalPages' | 'hasNext' | 'hasPrevious'>;

export interface SearchPage {
  items: PostSummary[];
  pagination: SearchPagination;
}

/** Round-robin merge of one page per type: a mixed list stays mixed instead
    of turning into a wall of a single type. Pages shorter than the rest are
    simply exhausted — the caller's totalPages is the longest of them. */
export function interleavePages(lists: PostSummary[][]): PostSummary[] {
  const depth = lists.reduce((max, list) => Math.max(max, list.length), 0);
  const merged: PostSummary[] = [];
  for (let index = 0; index < depth; index += 1) {
    for (const list of lists) {
      const item = list[index];
      if (item) merged.push(item);
    }
  }
  return merged;
}

/**
 * One page of search results. A scoped read is a single typed request (the
 * endpoint's own pagination, passed through untouched); the `all` scope
 * asks every public type for the same page and interleaves the answers —
 * that is what keeps real pagination available everywhere instead of
 * stopping at the grouped answer's page one.
 */
export async function loadSearchPage(
  client: AiyaClient,
  query: { key: string; scope: SearchScope; page: number; perPage?: number },
): Promise<SearchPage> {
  // The SSR window and the island's window must agree or the pagination
  // counters silently diverge; the caller's value wins, clamped to sane
  // bounds, and SEARCH_PAGE_SIZE stays the default.
  const perPage = Math.min(Math.max(query.perPage ?? SEARCH_PAGE_SIZE, 1), 50);
  if (query.scope !== 'all') {
    const result = await client.search({
      q: query.key,
      type: query.scope,
      page: query.page,
      perPage,
    });
    return { items: result.data, pagination: result.meta.pagination };
  }

  const groups = await Promise.all(
    SEARCH_TYPES.map((type) => client.search({ q: query.key, type, page: query.page, perPage })),
  );
  const totalPages = groups.reduce(
    (max, group) => Math.max(max, group.meta.pagination.totalPages),
    1,
  );
  return {
    items: interleavePages(groups.map((group) => group.data)),
    pagination: {
      page: query.page,
      totalPages,
      hasNext: query.page < totalPages,
      hasPrevious: query.page > 1,
    },
  };
}
