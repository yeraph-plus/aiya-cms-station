import { beforeAll, describe, expect, it } from 'vitest';
import {
  safeContent,
  sanitizeCommentHtml,
  sanitizeDiscussionHtml,
  sanitizeNotificationHtml,
} from '@/lib/content';
import { cloakDiscussion } from '@/lib/community';

beforeAll(() => {
  process.env.AIYA_WP_API_URL = 'http://localhost:8000/wp-json/aiya/core/v1/';
});

const EMOJI =
  '<img src="http://localhost:8000/wp-content/aiya_smilies/aru/01.png" alt="01" class="aiya-smilie" />';
const FOREIGN = '<img src="https://evil.test/x.png" alt="x">';

describe('sanitizeCommentHtml', () => {
  it('keeps smilies imgs, proxies their src and drops foreign images', () => {
    const out = sanitizeCommentHtml(`hi ${EMOJI} ${FOREIGN}`);
    expect(out).toContain('aiya-smilie');
    expect(out).toContain('/media/aiya_smilies/aru/01.png');
    expect(out).not.toContain('evil.test');
  });

  it('does not trust the smilies class alone: crafted remote pixels are dropped', () => {
    const crafted = '<img src="https://evil.test/pixel.png" alt="" class="aiya-smilie">';
    const out = sanitizeCommentHtml(`hi ${crafted}`);
    expect(out).not.toContain('evil.test');
    expect(out).not.toContain('<img');
  });

  it('never lets markup through: escaped entities stay text', () => {
    const out = sanitizeCommentHtml('a &lt;b&gt;bold&lt;/b&gt; &amp; done ::01::');
    expect(out).not.toContain('<b>');
    expect(out).toContain('&lt;b&gt;');
  });

  it('keeps plain text untouched', () => {
    expect(sanitizeCommentHtml('hello world')).toBe('hello world');
  });
});

describe('sanitizeDiscussionHtml smilies exemption', () => {
  it('keeps smilies imgs inline but still strips content images', () => {
    const out = sanitizeDiscussionHtml(`<p>x ${EMOJI} ${FOREIGN}</p>`);
    expect(out).toContain('aiya-smilie');
    expect(out).toContain('/media/aiya_smilies/aru/01.png');
    expect(out).not.toContain('evil.test');
  });

  it('strips a crafted smilies class riding a foreign src', () => {
    const out = sanitizeDiscussionHtml(
      `<p><img src="https://evil.test/pixel.png" class="aiya-smilie"></p>`,
    );
    expect(out).not.toContain('evil.test');
    expect(out).not.toContain('<img');
  });

  it('strips uploaded content images even after the media rewrite', () => {
    // The transform rewrites every WP-origin img to /media/ — the filter
    // must still strip it (only aiya_smilies/ paths survive this pass).
    const out = sanitizeDiscussionHtml(
      '<p><img src="http://localhost:8000/wp-content/uploads/2026/01/photo.jpg" alt=""></p>',
    );
    expect(out).toContain('<p>');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('photo.jpg');
  });
});

describe('safeContent smilies support', () => {
  it('preserves the smilies class and proxies the src', () => {
    const out = safeContent(`<p>${EMOJI}</p>`);
    expect(out).toContain('class="aiya-smilie"');
    expect(out).toContain('/media/aiya_smilies/aru/01.png');
  });
});

describe('cloakDiscussion / cloakReply', () => {
  const author = {
    id: 1,
    slug: 'admin',
    name: 'admin',
    avatar: {
      url: 'http://localhost:8000/wp-content/avatars/1/64.jpg',
      alt: '',
      width: 64,
      height: 64,
    },
  };
  const discussion = {
    id: 7,
    boardId: 1,
    board: '闲聊',
    author,
    status: 'open' as const,
    title: 't',
    contentHtml:
      '<p>raw <img src="http://localhost:8000/wp-content/aiya_smilies/a/01.png" class="aiya-smilie"></p>',
    images: [],
    replies: 0,
    views: 0,
    likes: 0,
    canEdit: true,
    canDelete: true,
    canReply: true,
    createdAt: '2026-09-01T00:00:00+08:00',
    activityAt: '2026-09-01T00:00:00+08:00',
    url: '/community/7/',
  };

  it('ships contentSafe but never the raw contentHtml', () => {
    const out = cloakDiscussion(discussion as never) as Record<string, unknown>;
    expect(out.contentHtml).toBeUndefined();
    expect(String(out.contentSafe)).toContain('aiya-smilie');
  });
});

describe('cssUrl', () => {
  it('escapes quote and backslash bytes out of the CSS string token', async () => {
    const { cssUrl } = await import('@/lib/media');
    // The backslash rides a code point so the expectations cannot lose one
    // more layer of literal escapes.
    const BS = String.fromCharCode(92);
    expect(cssUrl("https://x/a'b.jpg")).toBe(`https://x/a${BS}'b.jpg`);
    expect(cssUrl('https://x/a"b.jpg')).toBe(`https://x/a${BS}"b.jpg`);
    expect(cssUrl(`https://x/a${BS}b.jpg`)).toBe(`https://x/a${BS}${BS}b.jpg`);
    expect(cssUrl('https://x/plain.jpg')).toBe('https://x/plain.jpg');
  });
});

describe('reference markers (zero-routing)', () => {
  it('routes post markers by type and slug', () => {
    const html = safeContent(
      '<a data-aiya-ref="post" data-aiya-type="resource" data-aiya-slug="wallpaper">壁纸包</a>',
    );
    expect(html).toContain('href="/resources/wallpaper/"');
    expect(html).not.toContain('data-aiya-ref');
  });

  it('routes post markers of every public type', () => {
    for (const [type, prefix] of [
      ['post', 'posts'],
      ['page', 'pages'],
      ['resource', 'resources'],
    ] as const) {
      const html = safeContent(
        `<a data-aiya-ref="post" data-aiya-type="${type}" data-aiya-slug="s">x</a>`,
      );
      expect(html).toContain(`href="/${prefix}/s/"`);
    }
  });

  it('routes user markers to profiles', () => {
    const html = sanitizeDiscussionHtml(
      '<a data-aiya-ref="user" data-aiya-nicename="hub-tester">@hub-tester</a>',
    );
    expect(html).toContain('href="/profile/hub-tester/"');
  });

  it('routes term and search markers', () => {
    const term = sanitizeDiscussionHtml(
      '<a data-aiya-ref="term" data-aiya-taxonomy="category" data-aiya-slug="壁纸">壁纸</a>',
    );
    expect(term).toContain('href="/categories/%E5%A3%81%E7%BA%B8/"');

    const search = safeContent('<a data-aiya-ref="search" data-aiya-q="测试关键词">测试关键词</a>');
    expect(search).toContain('/search/');
    expect(search).toContain(encodeURIComponent('测试关键词'));
  });

  it('routes comment markers to the parent post anchored at the comment', () => {
    // The backend's comment handles are post+comment+type+slug (the same
    // four the [ref] part emits) — the parent slug rides data-aiya-slug.
    const html = sanitizeDiscussionHtml(
      '<a data-aiya-ref="comment" data-aiya-post="9" data-aiya-comment="12" data-aiya-type="post" data-aiya-slug="slug-9">评论摘录</a>',
    );
    expect(html).toContain('href="/posts/slug-9/#comment-12"');
  });

  it('routes thread markers to the community board', () => {
    const html = sanitizeDiscussionHtml(
      '<a data-aiya-ref="thread" data-aiya-board="question">问个问题</a>',
    );
    expect(html).toContain('href="/community/board/question/"');
  });

  it('strips the transport attributes from the output', () => {
    const html = safeContent(
      '<a data-aiya-ref="user" data-aiya-nicename="u" data-aiya-avatar="https://aiya.test/a.jpg">名</a>',
    );
    expect(html).not.toContain('data-aiya');
  });

  it('degrades markers without usable handles to inert text', () => {
    const html = safeContent('<a data-aiya-ref="user" data-aiya-nicename="">无名</a>');
    expect(html).not.toContain('href=');
    expect(html).toContain('无名');
  });
});

describe('sanitizeNotificationHtml', () => {
  it('resolves the backend soft anchor into a routed href and strips the handles', () => {
    const out = sanitizeNotificationHtml(
      '<a data-aiya-ref="comment" data-aiya-post="9" data-aiya-comment="12" data-aiya-type="post" data-aiya-slug="slug-9">评论了你的文章</a>',
    );
    expect(out).toBe('<a href="/posts/slug-9/#comment-12">评论了你的文章</a>');
  });

  it('leaves an anchor-free title as the escaped plain text it shipped as', () => {
    expect(sanitizeNotificationHtml('你的账户入账 +66 积分。')).toBe('你的账户入账 +66 积分。');
  });

  it('unwraps smuggled markup and keeps only the text', () => {
    // <script> is a non-text tag: its content vanishes with the tag.
    const out = sanitizeNotificationHtml(
      '提到你 <img src="https://evil.test/x.png" alt="x"> <script>alert(1)</script>请看',
    );
    expect(out).toBe('提到你  请看');
  });
});
