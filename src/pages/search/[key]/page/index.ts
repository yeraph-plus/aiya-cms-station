import type { APIRoute } from 'astro';

import { normalizeKeyword, searchPath } from '@/lib/search';

// Page-number-less shape: permanent normalization to the search root.
// The keyword is normalized like the results route — whitespace-only
// shapes go home instead of encoding into the path.
export const GET: APIRoute = ({ params, url, redirect }) => {
  const key = normalizeKeyword(params.key ?? '');
  return redirect(key === '' ? '/' : `${searchPath(key)}${url.search}`, 308);
};
