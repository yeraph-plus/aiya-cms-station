import type { APIRoute } from 'astro';
import { backend } from '@/lib/aiya/health';
import { robotsTxt } from '@/lib/seo';

export const GET: APIRoute = async () => {
  // Indexing follows reachability: a backend that cannot serve pages must not
  // have its URLs collected. Shares the middleware gate's breaker, so the two
  // surfaces never disagree.
  const indexable = await backend.isReachable();
  return new Response(robotsTxt(indexable), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
