import { beforeAll, describe, expect, it } from 'vitest';
import { safeContent, sanitizeCommentHtml, sanitizeDiscussionHtml } from '@/lib/content';

beforeAll(() => {
  process.env.AIYA_WP_API_URL = 'http://localhost:8000/wp-json/aiya/core/v1/';
});

const EMOJI = '<img src="http://localhost:8000/wp-content/smilies/aru/01.png" alt="01" class="aiya-smilie" />';
const FOREIGN = '<img src="https://evil.test/x.png" alt="x">';

describe('sanitizeCommentHtml', () => {
  it('keeps smilies imgs, proxies their src and drops foreign images', () => {
    const out = sanitizeCommentHtml(`hi ${EMOJI} ${FOREIGN}`);
    expect(out).toContain('aiya-smilie');
    expect(out).toContain('/media/wp-content/smilies/aru/01.png');
    expect(out).not.toContain('evil.test');
  });

  it('does not trust the smilies class alone: crafted remote pixels are dropped', () => {
    const crafted =
      '<img src="https://evil.test/pixel.png" alt="" class="aiya-smilie">';
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
    expect(out).toContain('/media/wp-content/smilies/aru/01.png');
    expect(out).not.toContain('evil.test');
  });

  it('strips a crafted smilies class riding a foreign src', () => {
    const out = sanitizeDiscussionHtml(
      `<p><img src="https://evil.test/pixel.png" class="aiya-smilie"></p>`,
    );
    expect(out).not.toContain('evil.test');
    expect(out).not.toContain('<img');
  });
});

describe('safeContent smilies support', () => {
  it('preserves the smilies class and proxies the src', () => {
    const out = safeContent(`<p>${EMOJI}</p>`);
    expect(out).toContain('class="aiya-smilie"');
    expect(out).toContain('/media/wp-content/smilies/aru/01.png');
  });
});
