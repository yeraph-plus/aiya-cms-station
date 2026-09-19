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
