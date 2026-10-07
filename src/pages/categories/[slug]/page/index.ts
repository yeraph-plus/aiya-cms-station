import type { APIRoute } from 'astro';

// Page-number-less shape: bounce to the archive root ('page' guard as
// above). Astro params arrive decoded; re-encode the segment (a raw CJK
// slug would break the Location header).
export const GET: APIRoute = ({ params, url, redirect }) => {
  const slug = params.slug ?? '';
  return redirect(
    slug === 'page'
      ? `/categories/${url.search}`
      : `/categories/${encodeURIComponent(slug)}/${url.search}`,
    308,
  );
};
