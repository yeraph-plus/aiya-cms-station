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

export interface TermArchiveProps {
  type: 'posts' | 'resources' | 'pages';
  taxonomy: 'category' | 'tag';
  slug: string;
  page: number;
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
  /** Owning public type (hub-resolved; = props.type for nested routes). */
  type: TermArchiveProps['type'];
  /** Raw term name (the view title carries the localized prefix). */
  name: string;
  pageNumber: number;
  archiveBase: string;
  pagePattern: string;
  feed: string;
  /** Feed query minus pagination keys (the island adds those itself). */
  filter: { category?: string; tag?: string; sort: 'newest' | 'oldest' };
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

// Static per-type wiring: which URL base, which feed proxy and which
// /terms arguments resolve the term name ('all' sweeps the five resource
// tag vocabularies). pages has no tag vocabulary — never mounted.
const CONFIG = {
  posts: {
    base: '/posts/',
    feed: '/api/feed/posts/',
    terms: {
      category: ['category', 'post'],
      tag: ['tag', 'post'],
    },
  },
  resources: {
    base: '/resources/',
    feed: '/api/feed/resources/',
    terms: {
      category: ['category', 'resource'],
      tag: ['all', 'resource'],
    },
  },
  pages: {
    base: '/pages/',
    feed: '/api/feed/pages/',
    terms: {
      category: ['category', 'page'],
      tag: null,
    },
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
  const page = await loadPage<CategoryCard[]>(async (client) => {
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
  }, astro.cookies, astro.locals.visitorIp);
  return { page, title: t(page.locale).categories.title };
}

/** Resolves which public type owns a category slug (priority: posts →
    resources → pages) and delegates to the term archive loader — the
    unified /categories/[slug]/ first-level route. */
export async function loadCategoryHub(
  astro: { response: { status?: number }; url: URL; cookies: AstroCookies;
    locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null } },
  props: { slug: string; page: number },
): Promise<TermArchiveView> {
  const errorView = async (error: unknown): Promise<TermArchiveView> => {
    // Frame the failure through loadPage so the shell (site/menu/locale)
    // stays complete and pageError maps the status (404/502/...).
    const page = await loadPage<TermArchiveValue>(async () => {
      throw error;
    }, astro.cookies, astro.locals.visitorIp);
    // The resource always throws: the union is guaranteed to be the error
    // branch here.
    if (page.ok) throw new Error('unreachable: error view resource threw');
    astro.response.status = page.error.status;
    return {
      page,
      type: 'posts',
      name: '',
      pageNumber: props.page,
      archiveBase: `/categories/${props.slug}/`,
      pagePattern: `/categories/${props.slug}/page/{page}/`,
      feed: '',
      filter: { sort: 'newest' },
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
  try {
    const probes = await Promise.all([
      // Same-origin server client only — resolution needs no cookies.
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'post');
      })(),
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'resource');
      })(),
      (async () => {
        const client = (await import('@/lib/core/server')).serverClient(astro.locals.visitorIp);
        return client.terms('category', 'page');
      })(),
    ]);
    for (let i = 0; i < CATEGORY_TYPES.length; i += 1) {
      if (probes[i].data.some((entry) => entry.slug === props.slug && entry.taxonomy === 'category')) {
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
  return loadTermArchive(
    astro.response,
    astro.url,
    astro.cookies,
    astro.locals,
    { type: resolved, taxonomy: 'category', slug: props.slug, page: props.page },
  );
}

/**
 * Resolves one term archive (page fetch, term name, titles, status codes,
 * breadcrumbs) for the nested /{base}/(category|tag)/[slug]/ routes. MUST
 * run in page frontmatter: the 404 / over-range status assignments only
 * apply before the page body starts rendering.
 */
export async function loadTermArchive(
  response: { status?: number },
  url: URL,
  cookies: AstroCookies,
  locals: { breadcrumbs?: Crumb[]; visitorIp?: string | null },
  props: TermArchiveProps,
): Promise<TermArchiveView> {
  const { type, taxonomy, slug, page: pageNumber } = props;
  const config = CONFIG[type];
  const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const archiveBase = `${config.base}${taxonomy}/${slug}/`;

  const page = await loadPage<TermArchiveValue>(async (client) => {
    const filter = taxonomy === 'category' ? { category: slug } : { tag: slug };
    // pages+tag is never mounted; fall back to the category vocabulary
    const [termsTaxonomy, termsType] = config.terms[taxonomy] ?? config.terms.category;
    const [list, terms] = await Promise.all([
      type === 'posts'
        ? client.posts({ ...filter, page: pageNumber, sort })
        : type === 'resources'
          ? client.resources({ ...filter, page: pageNumber, sort })
          : client.pages({ ...filter, page: pageNumber, sort }),
      client.terms(termsTaxonomy, termsType),
    ]);
    const term = terms.data.find((entry) => entry.slug === slug && entry.taxonomy === taxonomy);
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
  }, cookies, locals.visitorIp);

  if (!page.ok) response.status = page.error.status;
  // Empty archives (totalPages 0) must render their empty state, not 404.
  const overRange = page.ok && pageNumber > 1 && pageNumber > page.value.pagination.totalPages;
  if (overRange) response.status = 404;

  const copy = t(page.locale);
  const copyFor = {
    posts: {
      section: copy.posts.title,
      title: page.ok
        ? taxonomy === 'category'
          ? copy.posts.categoryTitle(page.value.name)
          : copy.posts.tagTitle(page.value.name)
        : '',
      empty: taxonomy === 'category' ? copy.posts.categoryEmpty : copy.posts.tagEmpty,
      pageOf: copy.posts.pageOf,
    },
    resources: {
      section: copy.resources.title,
      title: page.ok
        ? taxonomy === 'category'
          ? copy.resources.categoryTitle(page.value.name)
          : copy.resources.tagTitle(page.value.name)
        : '',
      empty: taxonomy === 'category' ? copy.resources.categoryEmpty : copy.resources.tagEmpty,
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
    filter: { ...(taxonomy === 'category' ? { category: slug } : { tag: slug }), sort },
    title,
    description: page.ok ? page.value.description : '',
    cover: page.ok ? page.value.cover : null,
    count: page.ok ? page.value.count : 0,
    icon: page.ok ? page.value.icon : null,
    emptyText: copyFor.empty,
    locale: page.locale,
  };
}
