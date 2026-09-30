import { cloakPostSummaryMedia, rewriteMediaUrl } from '@/lib/media';
import { safeContent } from '@/lib/content';
import { iconInner } from '@/lib/icons';
import type { PostDetail } from '@/lib/core/contracts';

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
