import { cloakPostSummaryMedia, rewriteMediaUrl } from '@/lib/media';
import { safeContent } from '@/lib/content';
import type { PostDetail } from '@/lib/aiya/contracts';

/**
 * Detail routes are slug-keyed; Astro leaves params percent-encoded for
 * non-ASCII slugs (e.g. WP's `%e4%b8%ad...` post_name forms), so decode
 * once, tolerantly — an already-decoded string just passes through.
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
