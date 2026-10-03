import type { AstroCookies } from 'astro';
import type { Crumb } from '@/lib/breadcrumbs';
import { setCrumbs } from '@/lib/breadcrumbs';
import { AiyaApiError } from '@/lib/core/errors';
import type { Image, Pagination, PostSummary } from '@/lib/core/contracts';
import { iconInner } from '@/lib/icons';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import type { PageResult } from '@/lib/page.server';
import { loadPage } from '@/lib/page.server';
import { categoryArchivePaths } from '@/lib/routes';

export interface TermArchiveProps {
  type: 'posts' | 'resources' | 'pages';
  slug: string;
  page: number;
  /** Mounted-route URL base (categoryArchivePaths) — canonical, pagination
      and retry links all derive from it, never from the section root. */
  archiveBase: string;
}

export interface TermArchiveValue {
  items: PostSummary[];
  pagination: Pagination;
  name: string;
  description: string;
  /** Term archive banner (media library); null when unset. */
  cover: Image | null;
  count: number;
  /** Term icon meta resolved to inner SVG (null when unresolvable). */
  icon: string | null;
}

export interface TermArchiveView {
  page: PageResult<TermArchiveValue>;
  /** Owning public type (hub-resolved; = props.type on delegation). */
  type: TermArchiveProps['type'];
  /** Raw term name (the view title carries the localized prefix). */
  name: string;
  pageNumber: number;
  archiveBase: string;
  pagePattern: string;
  feed: string;
  /** Feed query minus pagination keys (the island adds those itself). */
  filter: { category: string; sort: 'newest' | 'oldest' };
  title: string;
  /** The term's own description ('' when unset) — downstream description
      registration; the renderer falls back to the site default. */
  description: string;
  cover: Image | null;
  count: number;
  icon: string | null;
  emptyText: string;
  locale: Locale;
}

// Static per-type wiring: which section root (breadcrumb link only — the
// archive URL base lives in categoryArchivePaths), which feed proxy and
// which /terms arguments resolve the term name. Tag archives were removed
// with the tag-hub page (standing decision): tag filtering lives on the
// list pages' ?tag= state, so every archive resolves the category
// vocabulary only.
const CONFIG = {
  posts: {
    base: '/posts/',
    feed: '/api/feed/posts/',
    terms: { category: ['category', 'post'] },
  },
  resources: {
    base: '/resources/',
    feed: '/api/feed/resources/',
    terms: { category: ['category', 'resource'] },
  },
  pages: {
    base: '/pages/',
    feed: '/api/feed/pages/',
    terms: { category: ['category', 'page'] },
  },
} as const;

/** Category taxonomy across the three public types, in hub resolution
    order — a slug existing in several types resolves to the first. */
const CATEGORY_TYPES = ['posts', 'resources', 'pages'] as const;

export interface CategoryCard {
  slug: string;
  name: string;
  description: string;
  cover: Image | null;
  count: number;
  type: (typeof CATEGORY_TYPES)[number];
  /** Raw term icon meta — resolve with iconInner for display. */
  icon: string | null;
}

/** Every category term of the three public types, for the /categories/
    hub directory. */
export async function loadCategoriesIndex(astro: {
  response: { status?: number };
  cookies: AstroCookies;
  locals: { visitorIp?: string | null };
}): Promise<{
  page: Awaited<ReturnType<typeof loadPage<CategoryCard[]>>>;
  title: string;
}> {
  const page = await loadPage<CategoryCard[]>(
    async (client) => {
      const [postTerms, resourceTerms, pageTerms] = await Promise.all([
        client.terms('category', 'post'),
        client.terms('category', 'resource'),
        client.terms('category', 'page'),
      ]);
      const cards: CategoryCard[] = [];
      const sources = [
        ['posts', postTerms.data],
        ['resources', resourceTerms.data],
        ['pages', pageTerms.data],
      ] as const;
      for (const [type, terms] of sources) {
        for (const term of terms) {
          if (term.taxonomy !== 'category') continue;
          cards.push({
            slug: term.slug,
            name: term.name,
            description: term.description,
            cover: term.cover,
            count: term.count,
            type,
            icon: term.icon,
          });
        }
      }
      return cards;
    },
    astro.cookies,
    astro.locals.visitorIp,
  );
  return { page, title: t(page.locale).categories.title };
}

/** Resolves which public type owns a category slug (priority: posts →
    resources → pages) and delegates to the term archive loader — the
    unified /categories/[slug]/ first-level route. */
export async function loadCategoryHub(
  astro: {
    response: { status?: number };
    url: URL;
    cookies: AstroCookies;
    locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null };
  },
  props: { slug: string; page: number },
): Promise<TermArchiveView> {
  const errorView = async (error: unknown): Promise<TermArchiveView> => {
    // Frame the failure through loadPage so the shell (site/menu/locale)
    // stays complete and pageError maps the status (404/502/...).
    const page = await loadPage<TermArchiveValue>(
      async () => {
        throw error;
      },
      astro.cookies,
      astro.locals.visitorIp,
    );
    // The resource always throws: the union is guaranteed to be the error
    // branch here.
    if (page.ok) throw new Error('unreachable: error view resource threw');
    astro.response.status = page.error.status;
    return {
      page,
      type: 'posts',
      name: '',
      pageNumber: props.page,
      archiveBase: paths.base,
      pagePattern: paths.pagePattern,
      feed: '',
      filter: { category: '', sort: 'newest' },
      title: page.error.title,
      description: '',
      cover: null,
      count: 0,
      icon: null,
      emptyText: '',
      locale: page.locale,
    };
  };

  let resolved: TermArchiveProps['type'] | null = null;
  const paths = categoryArchivePaths(props.slug);
  try {
    const probes = await Promise.all([
      // Same-origin server client only — resolution needs no cookies. The
      // full set (no empties filter, no NSFW withholding): a direct visit
      // to an empty or NSFW-marked category archive still resolves (0.96.0).
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'post', { hideEmpty: false });
      })(),
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'resource', { hideEmpty: false });
      })(),
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'page', { hideEmpty: false });
      })(),
    ]);
    for (let i = 0; i < CATEGORY_TYPES.length; i += 1) {
      if (
        probes[i].data.some((entry) => entry.slug === props.slug && entry.taxonomy === 'category')
      ) {
        resolved = CATEGORY_TYPES[i];
        break;
      }
    }
  } catch (error) {
    return errorView(error);
  }
  if (resolved === null) {
    return errorView(new AiyaApiError('http', 404, undefined, 'aiya_not_found'));
  }
  return loadTermArchive(astro.response, astro.url, astro.cookies, astro.locals, {
    type: resolved,
    slug: props.slug,
    page: props.page,
    archiveBase: paths.base,
  });
}

/**
 * Resolves one term archive (page fetch, term name, titles, status codes,
 * breadcrumbs) under the unified /categories/ routes — the URL base rides
 * in on props (categoryArchivePaths); the type's section root is only the
 * breadcrumb link. MUST run in page frontmatter: the 404 / over-range
 * status assignments only apply before the page body starts rendering.
 */
export async function loadTermArchive(
  response: { status?: number },
  url: URL,
  cookies: AstroCookies,
  locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null },
  props: TermArchiveProps,
): Promise<TermArchiveView> {
  const { type, slug, page: pageNumber, archiveBase } = props;
  const config = CONFIG[type];
  const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

  const page = await loadPage<TermArchiveValue>(
    async (client) => {
      const filter = { category: slug };
      const [termsTaxonomy, termsType] = config.terms.category;
      const [list, terms] = await Promise.all([
        // The list rides the factory's NSFW flag (the loop is a human
        // surface); the term lookup resolves from the FULL vocabulary so a
        // direct visit to an empty or NSFW-marked archive keeps its title.
        type === 'posts'
          ? client.posts({ ...filter, page: pageNumber, sort })
          : type === 'resources'
            ? client.resources({ ...filter, page: pageNumber, sort })
            : client.pages({ ...filter, page: pageNumber, sort }),
        client.terms(termsTaxonomy, termsType, { excludeNsfw: false, hideEmpty: false }),
      ]);
      const term = terms.data.find((entry) => entry.slug === slug);
      if (!term) throw new AiyaApiError('http', 404, undefined, 'aiya_not_found');
      return {
        items: list.data,
        pagination: list.meta.pagination,
        name: term.name,
        description: term.description,
        cover: term.cover,
        count: term.count,
        icon: term.icon ? iconInner(term.icon) : null,
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
  const copyFor = {
    posts: {
      section: copy.posts.title,
      title: page.ok ? copy.posts.categoryTitle(page.value.name) : '',
      empty: copy.posts.categoryEmpty,
      pageOf: copy.posts.pageOf,
    },
    resources: {
      section: copy.resources.title,
      title: page.ok ? copy.resources.categoryTitle(page.value.name) : '',
      empty: copy.resources.categoryEmpty,
      pageOf: copy.resources.pageOf,
    },
    pages: {
      section: copy.pages.title,
      title: page.ok ? copy.pages.categoryTitle(page.value.name) : '',
      empty: copy.pages.categoryEmpty,
      pageOf: copy.pages.pageOf,
    },
  }[type];
  const title = page.ok ? copyFor.title : copy.state.notFoundTitle;
  if (page.ok) {
    const crumbs: Crumb[] = [{ label: copyFor.section, href: config.base }, { label: title }];
    if (pageNumber > 1) crumbs.push({ label: copyFor.pageOf(pageNumber) });
    setCrumbs(locals, page.locale, crumbs);
  }

  return {
    page,
    type,
    name: page.ok ? page.value.name : '',
    pageNumber,
    archiveBase,
    pagePattern: `${archiveBase}page/{page}/`,
    feed: config.feed,
    filter: { category: slug, sort },
    title,
    description: page.ok ? page.value.description : '',
    cover: page.ok ? page.value.cover : null,
    count: page.ok ? page.value.count : 0,
    icon: page.ok ? page.value.icon : null,
    emptyText: copyFor.empty,
    locale: page.locale,
  };
}
