import { describe, expect, it } from 'vitest';
import { safeContent } from '@/lib/content';
import { displayDate } from '@/lib/format';
import { articleJsonLd, breadcrumbJsonLd, robotsTxt, websiteJsonLd } from '@/lib/seo';

const site = {
  name: 'AIYA',
  description: '记录、整理与分享。',
  language: 'zh_CN',
  timezone: 'Asia/Shanghai',
  favicon: null,
  banner: null,
  registrationOpen: false,
  defaults: {
    colorMode: 'system' as const,
    thumb: null,
    emptyImage: null,
    theme: { primary: '#e94f69' },
    seoKeywords: '',
    seoDescription: '',
    gaId: '',
  },
  footer: { links: [], hitokoto: false },
  comments: {
    requireNameEmail: true,
    commentMaxLinks: 0,
    moderation: true,
    previouslyApproved: true,
    threadComments: true,
    threadCommentsDepth: 3,
    pageComments: true,
    commentsPerPage: 20,
    defaultCommentsPage: 'newest' as const,
    commentOrder: 'desc' as const,
    commentRegistration: true,
  },
  blocks: {
    primary: [],
    secondary: [],
    adsTop: [],
    adsBottom: [],
    sections: [],
  },
};
const detail = {
  id: 101,
  slug: 'hello',
  type: 'post' as const,
  title: '你好世界',
  excerpt: '摘要',
  publishedAt: '2026-09-09T10:00:00+08:00',
  updatedAt: '2026-09-09T11:00:00+08:00',
  readingMinutes: 2,
  thumbnail: { url: 'https://cdn.example.com/cover.jpg', alt: '封面', width: 640, height: 360 },
  featured: null,
  badges: [],
  locked: false,
  visibility: 'public' as const,
  gated: false,
  commentsOpen: true,
  hasManualExcerpt: false,
  author: { id: 1, slug: 'zhan-zhang', name: '站长', avatar: null },
  categories: [],
  tags: [],
  metrics: { views: 0, likes: 0, comments: 0, ratingScore: null, ratingCount: null },
  content: { format: 'html' as const, html: '<p>正文</p>' },
  seo: { title: '你好世界', description: '摘要', noindex: false },
  breadcrumbs: [{ label: '你好世界' }],
  previous: null,
  next: null,
  viewerLiked: false,
  viewerFavorited: false,
  viewerRating: null,
};

describe('JSON-LD builders', () => {
  it('builds a WebSite node', () => {
    const data = websiteJsonLd(site, 'https://aiya.example.com');
    expect(data['@type']).toBe('WebSite');
    expect(data.url).toBe('https://aiya.example.com/');
  });

  it('builds an Article node from a post detail', () => {
    const data = articleJsonLd(detail, site, 'https://aiya.example.com');
    expect(data['@type']).toBe('Article');
    expect(data.headline).toBe('你好世界');
    expect(data.image).toBe('https://cdn.example.com/cover.jpg');
    expect(data.inLanguage).toBe('zh-CN');
    expect((data.mainEntityOfPage as Record<string, unknown>)['@id']).toBe(
      'https://aiya.example.com/posts/hello/',
    );
  });

  it('emits label-and-position list items (crumbs carry no routes)', () => {
    const data = breadcrumbJsonLd([{ label: '首页' }, { label: '当前' }]);
    const items = data.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ '@type': 'ListItem', position: 1, name: '首页' });
    expect(items[1]).toEqual({ '@type': 'ListItem', position: 2, name: '当前' });
    expect(items.some((item) => 'item' in item)).toBe(false);
  });
});

describe('safeContent', () => {
  it('keeps whitelisted markup and strips scripts, handlers and protocol-relative sources', () => {
    const cleaned = safeContent(
      '<p onclick="x()">ok</p><script>alert(1)</script><img src="//evil.example/x.png"><a href="javascript:alert(1)">x</a>',
    );
    expect(cleaned).toContain('<p>ok</p>');
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('onclick');
    expect(cleaned).not.toContain('//evil.example');
    expect(cleaned).not.toContain('javascript:');
  });
});

describe('displayDate', () => {
  it('formats per locale and tolerates empty input', () => {
    expect(displayDate('2026-09-09T10:00:00+08:00', 'zh_CN')).toBe('2026/09/09');
    expect(displayDate('2026-09-09T10:00:00+08:00', 'en_US')).toBe('09/09/2026');
    expect(displayDate('', 'zh_CN')).toBe('');
  });
});

describe('robotsTxt', () => {
  it('fails closed for an unreachable backend and advertises no sitemap', () => {
    const body = robotsTxt(false);
    expect(body).toBe('User-agent: *\nDisallow: /\n');
  });

  it('allows crawling with the API/query blacklists, AI groups and the sitemap pointer', () => {
    const body = robotsTxt(true, 'https://aiya.example.com/sitemap.xml');
    expect(body).toContain('Disallow: /api/');
    expect(body).toContain('Disallow: /search/');
    expect(body).toContain('Disallow: /*?*');
    expect(body).toContain('User-agent: GPTBot');
    expect(body).toContain('User-agent: ClaudeBot');
    expect(body).toContain('Sitemap: https://aiya.example.com/sitemap.xml');
    // The pointer is a top-level record, not part of a user-agent group.
    expect(body.includes('\n\nSitemap: ')).toBe(true);
  });
});
