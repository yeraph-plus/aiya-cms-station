import type { APIRoute } from 'astro';
import { serverClient, siteOrigin } from '@/lib/aiya/server';

const STATIC_PATHS = ['/', '/posts/', '/resources/', '/community/'];
/** Runaway guard: at most 50 × 100 items per type. */
const MAX_PAGES = 50;

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]!,
  );
}

/**
 * Lists published posts, resources, pages and discussions, plus the
 * per-type term archives, the community boards and the author profiles
 * (first page of each — crawlers follow the pagination links from there;
 * per-archive pagination is not enumerated). Author slugs dedupe from the
 * collected content items. The four lists run in parallel; a backend
 * failure answers an empty urlset — robots.txt already disallows indexing
 * there, so the two endpoints fail closed together.
 */
export const GET: APIRoute = async () => {
  const locs: string[] = [];
  try {
    const origin = siteOrigin();
    const client = serverClient();
    const collect = async (
      listPage: (
        page: number,
      ) => Promise<{
        data: { url: string; author: { slug: string } }[];
        meta: { pagination: { hasNext: boolean } };
      }>,
    ): Promise<string[]> => {
      const urls: string[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await listPage(page);
        for (const item of result.data) {
          urls.push(new URL(item.url, origin).href);
          authors.add(item.author.slug);
        }
        if (!result.meta.pagination.hasNext) break;
      }
      return urls;
    };
    const authors = new Set<string>();
    // Threads have no per-thread pages (the community is deliberately a
    // single app surface), so the sitemap carries the board archives.
    const [posts, resources, pages, postCategories, resourceTerms, pageCategories, boards] =
      await Promise.all([
        collect((page) => client.posts({ page, perPage: 100 })),
        collect((page) => client.resources({ page, perPage: 100 })),
        collect((page) => client.pages({ page, perPage: 100 })),
        client.terms('category', 'post'),
        client.terms('all', 'resource'),
        client.terms('category', 'page'),
        client.discussionBoards(),
      ]);
    for (const path of STATIC_PATHS) locs.push(new URL(path, origin).href);
    const categorySlugs = new Set<string>();
    for (const term of postCategories.data) {
      if (term.taxonomy === 'category') categorySlugs.add(term.slug);
    }
    // Tag archives are thin content (noindex) and filter by query param —
    // only category archives get sitemap entries.
    for (const term of resourceTerms.data) {
      if (term.taxonomy === 'category') categorySlugs.add(term.slug);
    }
    for (const term of pageCategories.data) {
      if (term.taxonomy === 'category') categorySlugs.add(term.slug);
    }
    for (const slug of categorySlugs) {
      locs.push(new URL(`/categories/${slug}/`, origin).href);
    }
    for (const board of boards.data) {
      locs.push(new URL(`/community/board/${board.slug}/`, origin).href);
    }
    for (const slug of authors) {
      locs.push(new URL(`/profile/${slug}/`, origin).href);
    }
    locs.push(...posts, ...resources, ...pages);
  } catch {
    /* fail closed */
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`)
    .join('')}</urlset>`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
