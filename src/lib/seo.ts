import type { Breadcrumb, PostDetail, Site } from '@/lib/aiya/contracts';
import { toBcp47, type Locale } from '@/lib/i18n/locale';
import { rewriteMediaUrl } from '@/lib/media';

/** Pure JSON-LD builders; BaseHead serializes whatever these return. */

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
  origin: string,
  locale: Locale,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: toBcp47(locale),
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
    /api/ JSON and query-string URLs denied) plus one explicit allow group
    per AI crawler; an unreachable backend fails closed and disallows all. */
export function robotsTxt(indexable: boolean): string {
  if (!indexable) return 'User-agent: *\nDisallow: /\n';
  const group = ['Allow: /', 'Disallow: /api/', 'Disallow: /*?*'];
  const lines = ['User-agent: *', ...group];
  for (const bot of AI_CRAWLERS) {
    lines.push('', `User-agent: ${bot}`, ...group);
  }
  return `${lines.join('\n')}\n`;
}
