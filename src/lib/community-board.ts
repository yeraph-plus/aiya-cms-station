import type { AstroCookies } from 'astro';
import type { Crumb } from '@/lib/breadcrumbs';
import { setCrumbs } from '@/lib/breadcrumbs';
import { AiyaApiError } from '@/lib/core/errors';
import type { Discussion, DiscussionBoard, Pagination } from '@/lib/core/contracts';
import { t } from '@/lib/i18n';
import type { PageResult } from '@/lib/page.server';
import { loadPage } from '@/lib/page.server';
import { boardPaths } from '@/lib/routes';

export interface CommunityBoardValue {
  /** Raw discussions — the island boundary cloaks them, the SSR cards take
      them as-is (DiscussionCard expects the uncloaked shape). */
  list: Discussion[];
  pagination: Pagination;
  boards: DiscussionBoard[];
  boardName: string;
  boardDescription: string;
}

export interface CommunityBoardView {
  page: PageResult<CommunityBoardValue>;
  pageNumber: number;
  base: string;
  title: string;
  /** The board's own description ('' on the all feed or when unset). */
  description: string;
  noindex: boolean;
  sort: 'last_activity' | 'newest';
  canPost: boolean;
  /** Path for one board-rail entry ('' = the all feed). */
  boardHref: (slug: string) => string;
  /** Path for one pagination target. */
  listHref: (target: number) => string;
}

/**
 * Resolves the community surface shared by /community/ and the board
 * archives /community/board/[slug]/ — page 1 hosts the island, later pages
 * render SSR cards for crawlers. MUST run in page frontmatter: status
 * assignments only apply before the body starts rendering. Board switching
 * navigates by path; sort stays a query param.
 */
export async function loadCommunityBoard(
  response: { status?: number },
  url: URL,
  cookies: AstroCookies,
  locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null },
  props: { boardSlug: string; page: number },
): Promise<CommunityBoardView> {
  const { boardSlug, page: pageNumber } = props;
  const sort = url.searchParams.get('sort') === 'newest' ? 'newest' : 'last_activity';
  const base = boardSlug === '' ? '/community/' : boardPaths(boardSlug).base;

  const page = await loadPage<CommunityBoardValue>(
    async (client) => {
      const [list, boards] = await Promise.all([
        client.discussions({ board: boardSlug, sort, page: pageNumber }),
        client.discussionBoards(),
      ]);
      const board = boards.data.find((entry) => entry.slug === boardSlug);
      if (boardSlug !== '' && !board)
        throw new AiyaApiError('http', 404, undefined, 'aiya_not_found');
      return {
        list: list.data,
        pagination: list.meta.pagination,
        boards: boards.data,
        boardName: board?.name ?? '',
        boardDescription: board?.description ?? '',
      };
    },
    cookies,
    locals.visitorIp,
  );

  if (!page.ok) response.status = page.error.status;
  // Empty archives (totalPages 0) must render their empty state, not 404.
  const overRange = page.ok && pageNumber > 1 && pageNumber > page.value.pagination.totalPages;
  if (overRange) response.status = 404;

  const copy = t(page.locale);
  const noindex = overRange || sort !== 'last_activity';
  // A board read that failed mid-flight must not render an empty title:
  // the error branch falls back to the not-found copy like the archive does.
  const boardTitle =
    boardSlug !== ''
      ? page.ok
        ? copy.community.boardTitle(page.value.boardName)
        : copy.state.notFoundTitle
      : '';
  const title =
    boardSlug === ''
      ? pageNumber === 1
        ? copy.community.title
        : copy.community.pageOf(pageNumber)
      : boardTitle;
  const description =
    boardSlug === ''
      ? copy.community.description
      : page.ok
        ? page.value.boardDescription || copy.community.description
        : copy.community.description;
  if (page.ok) {
    const crumbs: Crumb[] = [{ label: copy.community.title, href: '/community/' }];
    if (boardSlug !== '') crumbs.push({ label: boardTitle });
    if (pageNumber > 1) crumbs.push({ label: copy.community.pageOf(pageNumber) });
    setCrumbs(locals, page.locale, crumbs);
  }

  const boardHref = (slug: string) => {
    const target = slug === '' ? '/community/' : boardPaths(slug).base;
    return sort !== 'last_activity' ? `${target}?sort=${sort}` : target;
  };
  const listHref = (target: number) =>
    target === 1 ? `${base}${sortQ(sort)}` : `${base}page/${target}/${sortQ(sort)}`;

  return {
    page,
    pageNumber,
    base,
    title,
    description,
    noindex,
    sort,
    canPost: Boolean(page.user) && !page.degraded,
    boardHref,
    listHref,
  };
}

function sortQ(sort: 'last_activity' | 'newest'): string {
  return sort !== 'last_activity' ? `?sort=${sort}` : '';
}
