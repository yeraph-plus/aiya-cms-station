import { cloakPostSummaryMedia, rewriteMediaUrl } from '@/lib/media';
import { safeContent } from '@/lib/content';
import { iconInner } from '@/lib/icons';
import type { PostDetail, Site } from '@/lib/core/contracts';
import type { AiyaClient } from '@/lib/core/client';
import { cloakDiscussion } from '@/lib/community';

/**
 * Detail routes are slug-keyed. Astro 7 DECODES route params before render
 * (validateAndDecodePathname), so this is a defensive no-op kept as a guard:
 * an already-decoded string passes through untouched. Do not add another
 * decode layer on top of route params — double-decoding `%25`-escapes would
 * corrupt slugs that legitimately contain `%`.
 */
export function detailSlug(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value === '' || !value.includes('%')) {
    return value;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Server-side projection for the three detail layout islands (and the
 * unlock proxy): the wire DTO carries WP-absolute media URLs and raw body
 * HTML — the islands receive cloaked URLs and text-safe HTML only. The
 * browser bundle cannot know the WP host, so client-side rewriting is a
 * no-op and every path into the browser must cross this boundary first.
 * The islands re-run `safeContent` as defense in depth; the pass is
 * idempotent.
 */
export function cloakPostDetail(detail: PostDetail): PostDetail {
  return {
    ...cloakPostSummaryMedia(detail),
    featured: detail.featured
      ? { ...detail.featured, url: rewriteMediaUrl(detail.featured.url) }
      : null,
    content: { ...detail.content, html: safeContent(detail.content.html) },
    previous: detail.previous ? cloakPostSummaryMedia(detail.previous) : null,
    next: detail.next ? cloakPostSummaryMedia(detail.next) : null,
  };
}

/**
 * Term icons pre-resolved for the detail headers: term id → inner SVG
 * (absent when the term carries no icon or the name does not resolve).
 * lucide-static is a server-only lookup — without this map riding the
 * island props, the ~2000-icon table enters the client bundle.
 */
export function termIconMap(detail: PostDetail): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const term of [...detail.categories, ...detail.tags]) {
    if (term.icon) map[String(term.id)] = iconInner(term.icon);
  }
  return map;
}

/** The three detail shells. */
export type DetailKind = 'post' | 'resource' | 'page';

/**
 * The shared detail assembly for the three shells: one typed read, the
 * comment window from /site, then the parallel best-effort reads (comments,
 * related, downloads, bound community threads, boards, author bio) — all
 * cloaked before the island sees it: media URLs and body HTML cross the
 * single-origin boundary here, not in the browser. The three routes
 * hand-copied this orchestration before and had already started drifting.
 */
export async function loadDetail(kind: DetailKind, client: AiyaClient, site: Site, slug: string) {
  const detail =
    kind === 'post'
      ? await client.post(slug)
      : kind === 'resource'
        ? await client.resource(slug)
        : await client.page(slug);
  // A WP-password-locked or members-gated body hides its comments too (the
  // read 404s), so the lock skips the fetch — the shell hides the section.
  const hidden = detail.data.locked || detail.data.gated;
  const perPage = site.comments.commentsPerPage;
  const order =
    site.comments.defaultCommentsPage === 'newest' ? ('desc' as const) : ('asc' as const);
  const commentsWindow = { order, perPage };

  // Pages carry no related grid, bound threads or boards — a page's kin are
  // the /pages/ index — so their read is the narrow subset.
  if (kind === 'page') {
    const [comments, downloads] = await Promise.all([
      hidden ? Promise.resolve(null) : client.comments(detail.data.id, { page: 1, perPage, order }),
      client.downloads(detail.data.id).catch(() => null),
    ]);
    const authorProfile = detail.data.author.slug
      ? await client.profile(detail.data.author.slug).catch(() => null)
      : null;
    return {
      post: cloakPostDetail(detail.data),
      termIcons: termIconMap(detail.data),
      comments: comments?.data ?? [],
      commentsPagination: comments?.meta.pagination ?? null,
      related: [],
      downloads: downloads?.data.lists ?? null,
      threads: [],
      threadsTotal: 0,
      boards: [],
      authorBio: authorProfile?.data.bio ?? '',
      authorId: detail.data.author.id,
      commentsWindow,
    };
  }

  const [comments, related, downloads, threads, boards] = await Promise.all([
    hidden ? Promise.resolve(null) : client.comments(detail.data.id, { page: 1, perPage, order }),
    client.related(detail.data.id),
    client.downloads(detail.data.id).catch(() => null),
    // Bound community threads for the sidebar feedback part; both reads are
    // best-effort — the sidebar renders its empty state when they fail.
    client.discussions({ post: detail.data.id, perPage: 5, sort: 'newest' }).catch(() => null),
    client.discussionBoards().catch(() => null),
  ]);
  const authorProfile = detail.data.author.slug
    ? await client.profile(detail.data.author.slug).catch(() => null)
    : null;
  return {
    post: cloakPostDetail(detail.data),
    termIcons: termIconMap(detail.data),
    comments: comments?.data ?? [],
    commentsPagination: comments?.meta.pagination ?? null,
    related: related.data.map(cloakPostSummaryMedia),
    downloads: downloads?.data.lists ?? null,
    threads: threads?.data.map(cloakDiscussion) ?? [],
    threadsTotal: threads?.meta.pagination.totalItems ?? 0,
    boards: boards?.data ?? [],
    authorBio: authorProfile?.data.bio ?? '',
    authorId: detail.data.author.id,
    commentsWindow,
  };
}
