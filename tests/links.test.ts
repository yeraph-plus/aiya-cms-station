import { describe, expect, it } from 'vitest';

import { LINK_DISPLAY_MAX, isCrossOrigin, isOutboundHref, linkDisplay } from '@/lib/links';

describe('isOutboundHref (the SSR rel stamp)', () => {
  it('accepts absolute http(s) targets', () => {
    expect(isOutboundHref('https://example.com/a')).toBe(true);
    expect(isOutboundHref('http://example.com')).toBe(true);
  });

  it('accepts protocol-relative targets', () => {
    expect(isOutboundHref('//example.com/a')).toBe(true);
  });

  it('rejects the site own shapes: relative, root-relative, page anchors', () => {
    expect(isOutboundHref('/posts/hello/')).toBe(false);
    expect(isOutboundHref('posts/hello/')).toBe(false);
    expect(isOutboundHref('#comment-12')).toBe(false);
    expect(isOutboundHref('')).toBe(false);
  });

  it('rejects non-web schemes', () => {
    expect(isOutboundHref('mailto:a@b.c')).toBe(false);
    expect(isOutboundHref('tel:+8610000000')).toBe(false);
    expect(isOutboundHref('javascript:alert(1)')).toBe(false);
  });
});

describe('isCrossOrigin (the bubble gate)', () => {
  const origin = 'https://aiya.example';

  it('gates other hosts, subdomains and protocol-relative targets', () => {
    expect(isCrossOrigin('https://other.example/x', origin)).toBe(true);
    expect(isCrossOrigin('https://blog.aiya.example/x', origin)).toBe(true);
    expect(isCrossOrigin('//other.example/x', origin)).toBe(true);
  });

  it('never gates the site own targets', () => {
    expect(isCrossOrigin('https://aiya.example/posts/a/', origin)).toBe(false);
    expect(isCrossOrigin('/posts/a/', origin)).toBe(false);
    expect(isCrossOrigin('posts/a/', origin)).toBe(false);
    expect(isCrossOrigin('#comment-1', origin)).toBe(false);
  });

  it('treats a scheme change as cross-origin and non-web schemes as no target', () => {
    expect(isCrossOrigin('http://aiya.example/x', origin)).toBe(true);
    expect(isCrossOrigin('mailto:a@b.c', origin)).toBe(false);
    expect(isCrossOrigin('tel:+8610000000', origin)).toBe(false);
    expect(isCrossOrigin('', origin)).toBe(false);
  });
});

describe('linkDisplay (the bubble line)', () => {
  it('prints host plus path and drops the query and hash', () => {
    expect(linkDisplay('https://example.com/a/b?utm=1#top')).toBe('example.com/a/b');
  });

  it('keeps a bare host readable', () => {
    expect(linkDisplay('https://example.com/')).toBe('example.com');
    expect(linkDisplay('https://example.com')).toBe('example.com');
  });

  it('keeps the port', () => {
    expect(linkDisplay('http://localhost:8000/wp-admin/')).toBe('localhost:8000/wp-admin/');
  });

  it('shows unicode targets in their ASCII/punycode form', () => {
    // WHATWG URL serialization — which is also the spoofing-resistant form
    // to print at a reader about to leave the site.
    const label = linkDisplay('https://例子.测试/路径/');
    expect(label.startsWith('xn--')).toBe(true);
    expect(label).not.toContain('例子');
  });

  it('middle-truncates long targets so both ends survive', () => {
    const label = linkDisplay(`https://example.com/${'segment/'.repeat(20)}end`);
    expect(label).toHaveLength(LINK_DISPLAY_MAX);
    expect(label.startsWith('example.com/')).toBe(true);
    expect(label.endsWith('end')).toBe(true);
    expect(label).toContain('…');
  });

  it('falls back to the raw string when the target is unparsable', () => {
    expect(linkDisplay('not a url')).toBe('not a url');
  });
});
