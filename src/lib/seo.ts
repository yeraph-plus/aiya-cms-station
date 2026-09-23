import type { Breadcrumb, PostDetail, Site } from '@/lib/core/contracts';
import { resolveLocale, toBcp47, type Locale } from '@/lib/i18n/locale';
import { rewriteMediaUrl } from '@/lib/media';

/** Pure JSON-LD builders; BaseHead serializes whatever these return. */

/**
 * JSON.stringify, with `<` escaped so a `</script>` inside any text field
 * (post title, author name, term label — all end up in JSON-LD) cannot close
 * the embedding element early: the HTML parser terminates a script on the
 * first `</script` byte sequence and knows nothing about JSON string syntax.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

export function websiteJsonLd(site: Site, origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    ...(site.description ? { description: site.description } : {}),
    url: absoluteUrl(origin, '/'),
  };
}

export function articleJsonLd(
  post: PostDetail,
  site: Site,
  origin: string,
  locale: Locale,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    // The site default language, not the visitor's session locale: this
    // describes the CONTENT, and a viewer preferring English must not flip
    // a Chinese article's declared language.
    inLanguage: toBcp47(resolveLocale({ site: site.language })),
    // Google's Article rich results look for the publisher reference.
    publisher: {
      '@type': 'Organization',
      name: site.name,
      url: absoluteUrl(origin, '/'),
    },
    // Same single-origin rewrite as og:image: the raw contract URL points at
    // the WP host, which the JSON-LD must not leak.
    ...(post.thumbnail ? { image: absoluteUrl(origin, rewriteMediaUrl(post.thumbnail.url)) } : {}),
    author: { '@type': 'Person', name: post.author.name },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(origin, post.url) },
  };
}

export function breadcrumbJsonLd(crumbs: Breadcrumb[], origin: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      // A null crumb URL means "this page"; the item reference is then omitted.
      ...(crumb.url ? { item: absoluteUrl(origin, crumb.url) } : {}),
    })),
  };
}

/**
 * Named AI crawlers granted full read access. The wildcard group below
 * already allows everything except API JSON and query-string URLs, but the
 * explicit per-agent groups are the machine-readable allowlist of record:
 * they keep working if the wildcard group is ever tightened, and AI index
 * builders read them as a statement of policy.
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'ClaudeBot',
  'Claude-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];

/** robots.txt body: indexable = blacklist approach (everything allowed,
    /api/ JSON, /search/ result pages and query-string URLs denied) plus one
    explicit allow group per AI crawler and the sitemap pointer; an
    unreachable backend fails closed and disallows all (no sitemap is
    advertised for a dead site). */
export function robotsTxt(indexable: boolean, sitemapUrl?: string): string {
  if (!indexable) return 'User-agent: *\nDisallow: /\n';
  const group = ['Allow: /', 'Disallow: /api/', 'Disallow: /search/', 'Disallow: /*?*'];
  const lines = ['User-agent: *', ...group];
  for (const bot of AI_CRAWLERS) {
    lines.push('', `User-agent: ${bot}`, ...group);
  }
  if (sitemapUrl) lines.push('', `Sitemap: ${sitemapUrl}`);
  return `${lines.join('\n')}\n`;
}
