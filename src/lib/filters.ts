/**
 * The list-filter query contract of the three PostLoop sections (posts /
 * resources / pages) and their paginated twins: q / category / tag / sort
 * are read with the same caps everywhere, a category chip's href is the
 * query state the island itself produces, and the canonical carries the
 * filters (never the sort preference). One source — page 1 and page N must
 * read identical keys, or a filter set on page 1 silently vanishes on
 * page 2. The category chip window (toolbar vs. filter panel) and its
 * single-select rule live here too: the two rows the split produces must
 * agree on both the ranking and what a click means.
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

/**
 * The category taxonomy never fits in one toolbar row, so its table is split
 * in two: the chip row carries the busiest `CATEGORY_CHIP_CAP` terms, the
 * filter panel's category row carries the rest. Both halves write the same
 * single-select `category` param, so the split is presentation only — the
 * union is the whole table and a selection survives either way.
 */
export const CATEGORY_CHIP_CAP = 12;

export interface ChipWindow<T> {
  /** The "all" chip plus the busiest terms, in ranking order. */
  toolbar: T[];
  /** Every term the toolbar window left out, in ranking order. */
  panel: T[];
}

/**
 * Split the chip list into the toolbar window and the panel remainder.
 * Ranking is the per-term published count (the figure the chips print),
 * most articles first; the backend's own term order breaks ties — the copy
 * is sorted (never the caller's array) and `Array#sort` is stable, so both
 * rows stay deterministic across requests. Chips without a count rank last.
 */
export function splitCategoryChips<T extends { slug: string; count?: number }>(
  chips: T[],
  cap: number = CATEGORY_CHIP_CAP,
): ChipWindow<T> {
  const all = chips.filter((chip) => chip.slug === '');
  const ranked = chips
    .filter((chip) => chip.slug !== '')
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  return { toolbar: [...all, ...ranked.slice(0, cap)], panel: ranked.slice(cap) };
}

/**
 * The single rule behind both category rows (toolbar chips and the panel's
 * category row): a click makes that term the only chosen category, and
 * clicking the active one — or the "all" chip — clears the selection. One
 * source so the two rows can never disagree on what a click means.
 */
export function nextCategorySelection(current: string[], slug: string): string[] {
  return slug === '' || (current.length === 1 && current[0] === slug) ? [] : [slug];
}
