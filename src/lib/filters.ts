/**
 * The list-filter query contract of the three PostLoop sections (posts /
 * resources / pages) and their paginated twins: q / category / tag / sort
 * are read with the same caps everywhere, a category chip's href is the
 * query state the island itself produces, and the canonical carries the
 * filters (never the sort preference). One source — page 1 and page N must
 * read identical keys, or a filter set on page 1 silently vanishes on
 * page 2.
 */

export interface ListFilters {
  q: string;
  category: string;
  tag: string;
  sort: 'oldest' | 'newest';
}

/** The keyword cap the search surface owns (lib/search uses the same). */
export const FILTER_Q_CAP = 100;
/** Vocabulary slug cap on filter params. */
export const FILTER_TERM_CAP = 200;

/** Parse the filter keys off a request URL. `withTag=false` for the pages
    section (no tag vocabulary) — its tag stays ''. */
export function parseListFilters(url: URL, withTag: boolean): ListFilters {
  return {
    q: (url.searchParams.get('q') ?? '').slice(0, FILTER_Q_CAP),
    category: (url.searchParams.get('category') ?? '').slice(0, FILTER_TERM_CAP),
    tag: withTag ? (url.searchParams.get('tag') ?? '').slice(0, FILTER_TERM_CAP) : '',
    sort: url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
  };
}

/** Any content filter (not the sort preference) set — the noindex signal. */
export function isFiltered(filters: ListFilters): boolean {
  return filters.q !== '' || filters.category !== '' || filters.tag !== '';
}

/** Canonical query string: the filters only, '' when unfiltered. */
export function canonicalQuery(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.category !== '') params.set('category', filters.category);
  if (filters.tag !== '') params.set('tag', filters.tag);
  return params.toString();
}

/** The href one category chip points at: this list's query state with the
    chip's slug selected ('' = clear the selection). The crawlable category
    archive is /categories/{slug}/ — chips deliberately stay query state. */
export function chipHref(base: string, filters: ListFilters, slug: string): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (slug !== '') params.set('category', slug);
  if (filters.tag !== '') params.set('tag', filters.tag);
  const query = params.toString();
  return query !== '' ? `${base}?${query}` : base;
}
