import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ArchiveHero,
  ArticleHero,
  BylinePanel,
  EventItem,
  NewsletterBand,
  PromoCard,
  Rail,
  RailItem,
  RailSection,
  SectionHeader,
  SpotlightHero,
  StoryCard,
  StoryGrid,
  TagList,
  VideoWall,
  type EditorialStory,
} from '@/components/editorial';

/**
 * Editorial skin guard (DESIGN.md §2 编辑部皮肤 + docs/EDITORIAL.md). The layer
 * ships into islands that render on the server first, so the render path must be
 * clean; the palette must stay in tokens.css; and the named type scale must be
 * the only way a component reaches a display size.
 */

const ROOT = join(import.meta.dirname, '..');
const DIR = join(ROOT, 'src/components/editorial');

const story: EditorialStory = {
  id: 'a',
  href: '/posts/a/',
  title: '测试标题',
  excerpt: '摘要',
  image: { url: '/media/a.jpg', alt: '封面' },
  category: 'sport',
  categoryHref: '/categories/sport/',
  author: 'Katy Liu',
  authorHref: '/profile/katy/',
  date: '2026/10/21',
  note: '3 分钟',
};

const slides = [
  { id: 's1', href: '/posts/a/', title: '第一张', kicker: 'sport', image: story.image },
  { id: 's2', href: '/posts/b/', title: '第二张', kicker: 'vogue', image: story.image },
];

const heroLabels = {
  region: '焦点图',
  slide: '幻灯片',
  next: '下一张',
  previous: '上一张',
  goTo: '跳转到',
  nextUp: '下一则',
};

describe('editorial components render on the server', () => {
  it('renders the carousel with one active, inert frame', () => {
    const html = renderToString(
      createElement(SpotlightHero, { slides, ctaLabel: '继续阅读', labels: heroLabels }),
    );
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('data-active="true"');
    expect(html).toContain('data-active="false"');
    expect(html).toContain('inert');
    expect(html).toContain('继续阅读');
    // Autoplay is opt-in: no timer state leaks into the markup.
    expect(html).not.toContain('setInterval');
  });

  it('renders every card geometry, the section panel and the rail', () => {
    const html = renderToString(
      createElement(
        'div',
        null,
        createElement(StoryCard, { story, variant: 'lead' }),
        createElement(StoryCard, { story, variant: 'portrait' }),
        createElement(StoryCard, { story, variant: 'cover' }),
        createElement(StoryCard, { story, variant: 'text' }),
        createElement(StoryCard, { story, variant: 'row' }),
        createElement(StoryCard, { story, variant: 'row-round' }),
        createElement(StoryGrid, { stories: [story, { ...story, id: 'b' }], featured: true }),
        createElement(SectionHeader, {
          title: '不要错过',
          tags: [{ label: '全部', href: '/', active: true }],
          more: { label: '更多', items: [{ label: 'sport', href: '/sport/' }] },
        }),
        createElement(Rail, {
          label: '侧栏',
          children: [
            createElement(RailSection, {
              key: 'top',
              title: '头条',
              // Plain data, never a node: an Astro page cannot hand a React
              // component an Astro-rendered element (the SSR stream dies).
              action: { label: 'top', href: '/top/' },
              children: [
                createElement(RailItem, { key: 'a', story }),
                createElement(RailItem, { key: 'b', story, round: true }),
                createElement(EventItem, {
                  key: 'c',
                  href: '/events/1/',
                  title: '活动',
                  day: '13',
                  month: 'APR',
                }),
              ],
            }),
          ],
        }),
        createElement(PromoCard, { href: '/ad/', title: '广告', eyebrow: '-15%' }),
        createElement(PromoCard, { href: '/ad/', title: '横幅', size: 'banner' }),
        createElement(ArticleHero, {
          title: story.title,
          kicker: story.category,
          image: story.image,
        }),
        createElement(BylinePanel, {
          author: story.author,
          date: story.date,
          shareLabel: '分享',
          share: [{ label: '复制链接', href: '/share' }],
        }),
        createElement(VideoWall, {
          items: [{ id: 'v1', title: '视频', href: '/v/1/', image: story.image }],
          playLabel: '播放',
        }),
      ),
    );
    expect(html).toContain('不要错过');
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('hero-scrim');
    // The rail action is data → rendered by the component, not passed as a node.
    expect(html).toContain('href="/top/"');
  });

  it('reproduces the silent category band and its titled variant', () => {
    // avision's category.html cover carries no text at all: fixed 360px band.
    const silent = renderToString(createElement(ArchiveHero, { image: story.image }));
    expect(silent).toContain('h-[22.5rem]');
    expect(silent).not.toContain('hero-scrim');
    // A real archive page names itself — then the band grows and gets an h1.
    const titled = renderToString(
      createElement(ArchiveHero, {
        title: '时尚',
        kicker: 'category',
        count: '共 32 篇',
        image: story.image,
      }),
    );
    expect(titled).toContain('<h1');
    expect(titled).toContain('时尚');
    expect(titled).toContain('共 32 篇');
    expect(titled).toContain('hero-scrim');
  });

  it('renders the article tag chips as a labelled list', () => {
    const html = renderToString(
      createElement(TagList, {
        tags: [{ label: 'Liberty', href: '/tags/liberty/' }, { label: 'Manual' }],
      }),
    );
    expect(html).toContain('aria-label="标签"');
    expect(html).toContain('href="/tags/liberty/"');
    expect(html).toContain('Manual');
  });

  it('keeps a real label on the newsletter field and a 44px submit target', () => {
    const html = renderToString(
      createElement(NewsletterBand, {
        title: '订阅',
        emailLabel: '邮箱地址',
        placeholder: '你的邮箱',
        submitLabel: '订阅',
      }),
    );
    expect(html).toContain('type="email"');
    expect(html).toContain('邮箱地址');
    expect(html).toContain('aria-label="订阅"');
    expect(html).toContain('size-11');
  });
});

describe('editorial tokens and recipes stay in their layers', () => {
  const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf-8');

  it('declares the skin scope, the dark pair and the ed palette', () => {
    expect(tokens).toContain('.theme-editorial {');
    expect(tokens).toContain('.dark .theme-editorial');
    expect(tokens).toContain('.theme-editorial.dark');
    for (const token of [
      '--ed-rail',
      '--ed-tile',
      '--ed-shell',
      '--ed-shell-deep',
      '--ed-accent',
      '--ed-accent-strong',
      '--ed-warm',
      '--ed-ghost',
      '--ed-on-shell',
    ]) {
      expect(tokens, `${token} must exist`).toContain(token);
    }
    // …and the @theme bridge, or the utilities would generate nothing.
    for (const utility of ['--color-ed-rail', '--color-ed-accent', '--color-ed-shell']) {
      expect(tokens).toContain(utility);
    }
  });

  it('names the display scale instead of leaving it to arbitrary sizes', () => {
    for (const scale of [
      '--text-label',
      '--text-display-sm',
      '--text-display-md',
      '--text-numeral',
    ]) {
      expect(tokens).toContain(scale);
    }
    for (const tracking of ['--tracking-kicker', '--tracking-brand']) {
      expect(tokens).toContain(tracking);
    }
  });

  const componentFiles = readdirSync(DIR).filter((file) => /\.(tsx|ts)$/.test(file));
  const sources = new Map(
    componentFiles.map((file) => [file, readFileSync(join(DIR, file), 'utf-8')] as const),
  );

  it('keeps hex literals in tokens.css (the style-guard whitelist has no skin entry)', () => {
    for (const [file, text] of sources) {
      expect(text, `${file} must not carry a hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });

  it('reaches display sizes through the named scale only', () => {
    for (const [file, text] of sources) {
      expect(text, `${file} must use the named type scale`).not.toMatch(/text-\[[^\]]*rem\]/);
      // Numeric duration utilities would bypass duration-fast/base/slow.
      expect(text, `${file} must use the motion tokens`).not.toMatch(/[^a-z-]duration-\d/);
    }
  });

  it('keeps editorial.css free of literal colours and durations', () => {
    const css = readFileSync(join(ROOT, 'src/styles/editorial.css'), 'utf-8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/(?:^|[^-])transition[^;:]*:[^;]*\d+\.?\d*m?s/);
    expect(css).not.toMatch(/font-family/);
  });
});
