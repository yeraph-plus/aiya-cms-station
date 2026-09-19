import { describe, expect, it } from 'vitest';
import { safeContent } from '@/lib/content';
import { displayDate } from '@/lib/format';
import { articleJsonLd, breadcrumbJsonLd, websiteJsonLd } from '@/lib/seo';

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
};
const detail = {
  id: 101,
  slug: 'hello',
  url: '/posts/101/',
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
  breadcrumbs: [{ label: '你好世界', url: null }],
  previous: null,
  next: null,
};

describe('JSON-LD builders', () => {
  it('builds a WebSite node', () => {
    const data = websiteJsonLd(site, 'https://aiya.example.com');
    expect(data['@type']).toBe('WebSite');
    expect(data.url).toBe('https://aiya.example.com/');
  });

  it('builds an Article node from a post detail', () => {
    const data = articleJsonLd(detail, 'https://aiya.example.com', 'zh_CN');
    expect(data['@type']).toBe('Article');
    expect(data.headline).toBe('你好世界');
    expect(data.image).toBe('https://cdn.example.com/cover.jpg');
    expect(data.inLanguage).toBe('zh-CN');
    expect((data.mainEntityOfPage as Record<string, unknown>)['@id']).toBe(
      'https://aiya.example.com/posts/101/',
    );
  });

  it('omits item refs for null breadcrumbs but keeps positions', () => {
    const data = breadcrumbJsonLd(
      [
        { label: '首页', url: '/' },
        { label: '当前', url: null },
      ],
      'https://aiya.example.com',
    );
    const items = data.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0].item).toBe('https://aiya.example.com/');
    expect(items[1]).not.toHaveProperty('item');
    expect(items[1].position).toBe(2);
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
