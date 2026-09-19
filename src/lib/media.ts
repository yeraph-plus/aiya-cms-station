/**
 * Media URL cloaking (single-origin contract): WP-origin `wp-content` URLs
 * are rewritten to `/media/...` and served by the local media proxy
 * (`lib/media-proxy.ts`, invoked from middleware), so the browser never
 * sees the WP host. Foreign URLs (gravatar, OpenList, payment platforms)
 * pass through untouched by design.
 *
 * Server-side only: the WP origin comes from `lib/wp-env.ts`, which reads
 * `AIYA_WP_API_URL` from process.env (built server) or import.meta.env
 * (Astro dev).
 */

import { rawWpApiUrl } from '@/lib/wp-env';

const wpOrigin = (): string => {
  const raw = rawWpApiUrl();
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
};

/** Dev loopback hosts (localhost / 127.0.0.1) point at the same WP. */
const normalizeHost = (origin: string): string =>
  origin.replace('://127.0.0.1', '://localhost').replace('://[::1]', '://localhost');

/** Rewrites WP `wp-content` URLs to local `/media/...` paths; everything else passes through. */
export function rewriteMediaUrl(url: string): string {
  const origin = normalizeHost(wpOrigin());
  if (origin === '') return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (normalizeHost(parsed.origin) !== origin) return url;
  if (!parsed.pathname.startsWith('/wp-content/')) return url;
  return `/media${parsed.pathname}${parsed.search}`;
}

/** Rewrites every URL inside a `srcset` value ("url 300w, url 1024w"). */
export function rewriteSrcset(srcset: string): string {
  return srcset
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (trimmed === '') return '';
      const [url, ...descriptors] = trimmed.split(/\s+/);
      return [rewriteMediaUrl(url), ...descriptors].join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

/** Cloaks every WP-absolute media URL inside a PostSummary (thumbnail +
    author avatar) so islands never receive the upstream host. Initial SSR
    props and /api/feed responses share this boundary. */
export function cloakPostSummaryMedia<T extends PostSummaryMedia>(item: T): T {
  return {
    ...item,
    thumbnail: item.thumbnail
      ? { ...item.thumbnail, url: rewriteMediaUrl(item.thumbnail.url) }
      : null,
    author: {
      ...item.author,
      avatar: item.author.avatar
        ? { ...item.author.avatar, url: rewriteMediaUrl(item.author.avatar.url) }
        : null,
    },
  };
}

interface PostSummaryMedia {
  thumbnail: { url: string; alt: string; width: number | null; height: number | null } | null;
  author: { name: string; avatar: { url: string } | null };
}
