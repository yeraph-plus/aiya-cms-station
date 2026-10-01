import { beforeAll, describe, expect, it } from 'vitest';
import { safeContent, sanitizeCommentHtml, sanitizeDiscussionHtml } from '@/lib/content';
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
