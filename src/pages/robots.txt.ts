import type { APIRoute } from 'astro';
import { backend } from '@/lib/aiya/health';
import { siteOrigin } from '@/lib/aiya/server';
import { robotsTxt } from '@/lib/seo';

export const GET: APIRoute = async () => {
  // Indexing follows reachability: a backend that cannot serve pages must not
  // have its URLs collected. Shares the middleware gate's breaker, so the two
  // surfaces never disagree.
  const indexable = await backend.isReachable();
  let sitemapUrl: string | undefined;
  if (indexable) {
    try {
      sitemapUrl = new URL('/sitemap.xml', siteOrigin()).href;
    } catch {
      /* degraded env: robots.txt ships without the pointer */
    }
  }
  return new Response(robotsTxt(indexable, sitemapUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
