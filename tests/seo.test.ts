import { describe, expect, it } from 'vitest';
import { robotsTxt, serializeJsonLd } from '@/lib/seo';

describe('serializeJsonLd', () => {
  it('keeps valid JSON intact', () => {
    const data = { headline: '标题 / "quotes"', n: 1 };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('escapes < so a payload title cannot close the embedding script', () => {
    const out = serializeJsonLd({ headline: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script');
    expect(out).toContain('\\u003c/script>');
    expect(JSON.parse(out)).toEqual({ headline: '</script><script>alert(1)</script>' });
  });
});

describe('robotsTxt', () => {
  it('fails closed on an unreachable backend', () => {
    expect(robotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
  });

  it('denies the API surface, search results and query strings when indexable', () => {
    const body = robotsTxt(true, 'https://front.example/sitemap.xml');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /search/');
    expect(body).toContain('Disallow: /*?*');
    expect(body).toContain('Sitemap: https://front.example/sitemap.xml');
  });
});
