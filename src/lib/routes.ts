/**
 * URL shapes of first-class routes as pure functions — the single source a
 * loader, its error view and a renderer must all agree on. Dependency-free
 * by charter so tests import the real shapes (no Astro/virtual modules).
 */

/** The unified category archive: entry and {page} pattern of the mounted
    /categories/[slug]/(page/[n]/) routes. The slug segment passes through
    verbatim — URL/browser layers encode it, matching CategoryCards. */
export function categoryArchivePaths(slug: string): { base: string; pagePattern: string } {
  return {
    base: `/categories/${slug}/`,
    pagePattern: `/categories/${slug}/page/{page}/`,
  };
}
