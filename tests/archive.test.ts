import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryArchivePaths } from '@/lib/routes';

describe('category archive paths', () => {
  it('builds the entry and {page} pattern for a slug', () => {
    expect(categoryArchivePaths('news')).toEqual({
      base: '/categories/news/',
      pagePattern: '/categories/news/page/{page}/',
    });
  });

  it('passes the slug segment through verbatim (URL layers encode it)', () => {
    const { base } = categoryArchivePaths('%E6%96%87%E7%AB%A0');
    expect(base).toBe('/categories/%E6%96%87%E7%AB%A0/');
  });

  it('stays in lockstep with the mounted /categories/ routes', () => {
    // The regression this pins: the loader once derived /posts/category/
    // {slug}/ canonicals and pagination hrefs for routes that no longer
    // exist. These two files ARE the shapes categoryArchivePaths emits.
    expect(existsSync('src/pages/categories/[slug]/index.astro')).toBe(true);
    expect(existsSync('src/pages/categories/[slug]/page/[n].astro')).toBe(true);
  });
});
