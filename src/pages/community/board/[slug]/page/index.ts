import type { APIRoute } from 'astro';

// Page-number-less shape: permanent normalization to the board root
// ('page' guard as above); the active sort query rides along.
export const GET: APIRoute = ({ params, url, redirect }) => {
  const slug = params.slug ?? '';
  return redirect(
    slug === 'page'
      ? `/community/${url.search}`
      : `/community/board/${encodeURIComponent(slug)}/${url.search}`,
    308,
  );
};
