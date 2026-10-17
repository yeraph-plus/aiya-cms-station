/**
 * Outbound-link helpers for the article body's safety bubble (UX.md §7): the
 * SSR pass uses `isOutboundHref` to stamp `rel`, the island's DOM binding
 * uses `isCrossOrigin` to decide what the bubble gates, and `linkDisplay`
 * renders the target line. Pure string work shared by both sides of
 * hydration — no DOM, no env — so the two passes cannot drift.
 */

/** Absolute http(s) URL. Relative targets, page anchors (`#id`) and non-web
    schemes (`mailto:`, `tel:`) are not somewhere else to go. */
function isHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Outbound shape for the `rel` stamp at the sanitization boundary: an
 * absolute http(s) URL or a protocol-relative target (`//host/x`). Both
 * point at another host by construction, so the boundary needs no site
 * origin; a self-referencing absolute URL reads as outbound here (rare, and
 * `nofollow` on it is harmless), while every in-content route the reference
 * markers build stays relative and is exempt.
 */
export function isOutboundHref(href: string): boolean {
  return href.startsWith('//') || isHttpUrl(href);
}

/**
 * Cross-origin web target — what the bubble gates. Resolved against the live
 * origin, so relative/root-relative targets are the site's own, and
 * `mailto:`-style schemes (opaque origin `null`) never read as elsewhere.
 */
export function isCrossOrigin(href: string, origin: string): boolean {
  try {
    const url = new URL(href, origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin !== origin;
  } catch {
    return false;
  }
}

/** Longest target line the bubble prints before middle-truncating. */
export const LINK_DISPLAY_MAX = 64;

/**
 * The bubble's one-line target: host + path, query and hash dropped (rarely
 * the part that tells a reader where they are going), middle-truncated so
 * the host and the tail both stay readable.
 */
export function linkDisplay(href: string, max = LINK_DISPLAY_MAX): string {
  let label = href;
  try {
    const url = new URL(href);
    label = url.pathname === '/' ? url.host : `${url.host}${url.pathname}`;
  } catch {
    // Unparsable — the bubble only ever receives http(s) hrefs; print the raw
    // string rather than an empty line.
  }
  if (label.length <= max) return label;
  const head = Math.ceil((max - 1) / 2);
  return `${label.slice(0, head)}…${label.slice(label.length - (max - 1 - head))}`;
}
