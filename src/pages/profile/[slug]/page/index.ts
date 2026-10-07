import type { APIRoute } from 'astro';

// Page-number-less shape: permanent normalization to the profile root,
// and the active sort query rides along.
export const GET: APIRoute = ({ params, url, redirect }) =>
  redirect(`/profile/${encodeURIComponent(params.slug ?? '')}/${url.search}`, 308);
