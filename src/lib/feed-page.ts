import type { AstroCookies } from 'astro';
import type { Crumb } from '@/lib/breadcrumbs';
import { setCrumbs } from '@/lib/breadcrumbs';
import type { Pagination, PostSummary } from '@/lib/core/contracts';
import { t } from '@/lib/i18n';
import { cloakPostSummaryMedia } from '@/lib/media';
import type { PageResult } from '@/lib/page.server';
import { loadPage } from '@/lib/page.server';
import { isFiltered, parseListFilters, type ListFilters } from '@/lib/filters';

/** The three PostLoop list sections. */
export type FeedKind = 'posts' | 'resources' | 'pages';

export interface FeedListValue {
  items: PostSummary[];
  pagination: Pagination;
}

export interface FeedPageView {
  page: PageResult<FeedListValue>;
  n: number;
  filters: ListFilters;
  filtered: boolean;
  overRange: boolean;
  listTitle: string;
  canonical: string;
}

/**
 * One paginated PostLoop list (page ≥ 2) for the three feed sections. The
 * guard stays in the route — n < 2 / non-numeric 308s to the section root
 * and needs Astro.redirect — everything else assembles here: filter parse
 * (the same keys page 1 reads), the per-kind list read, status assignment,
 * the over-range 404, crumbs, title and canonical. The three routes
 * hand-copied this flow before; the copies had already started drifting
 * (302 redirect dropping the filter query).
 */
export async function loadFeedPage(
  kind: FeedKind,
  response: { status?: number },
  url: URL,
  cookies: AstroCookies,
  locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null },
  n: number,
): Promise<FeedPageView> {
  const filters = parseListFilters(url, kind !== 'pages');
  const filtered = isFiltered(filters);

  const page = await loadPage<FeedListValue>(
    async (client) => {
      const list =
        kind === 'posts'
          ? await client.posts({
              page: n,
              q: filters.q,
              category: filters.category,
              tag: filters.tag,
              sort: filters.sort,
            })
          : kind === 'resources'
            ? await client.resources({
                page: n,
                q: filters.q,
                category: filters.category,
                tag: filters.tag,
                sort: filters.sort,
              })
            : await client.pages({
                page: n,
                q: filters.q,
                category: filters.category,
                sort: filters.sort,
              });
      return { items: list.data.map(cloakPostSummaryMedia), pagination: list.meta.pagination };
    },
    cookies,
    locals.visitorIp,
  );
  if (!page.ok) response.status = page.error.status;
  const overRange = page.ok && n > page.value.pagination.totalPages;
  if (overRange) response.status = 404;

  const copy = t(page.locale);
  if (page.ok) {
    setCrumbs(locals, page.locale, [
      { label: copy[kind].title, href: `/${kind}/` },
      { label: copy[kind].pageOf(n) },
    ]);
  }
  return {
    page,
    n,
    filters,
    filtered,
    overRange,
    // The pages section reuses the posts search title (its own dictionary
    // carries none — a page search is a post-projection search).
    listTitle: filters.q !== '' ? copy.posts.searchTitle(filters.q) : copy[kind].pageOf(n),
    // Bare canonical: the filtered shape is noindex, so carrying the filter
    // into the canonical buys nothing.
    canonical: `/${kind}/page/${n}/`,
  };
}
