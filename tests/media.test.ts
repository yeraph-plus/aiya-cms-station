import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AiyaApiError } from '@/lib/core/errors';
import { createAiyaClient } from '@/lib/core/client';
import { cloakProfileMedia, rewriteMediaUrl, rewriteSrcset } from '@/lib/media';
import { proxyMedia, resolveMediaTarget } from '@/lib/media-proxy';
import { safeContent } from '@/lib/content';

beforeAll(() => {
  process.env.AIYA_WP_API_URL = 'http://localhost:8000/wp-json/aiya/core/v1/';
});

describe('rewriteMediaUrl', () => {
  it('rewrites only wp-content URLs onto the /media proxy', () => {
    expect(rewriteMediaUrl('http://localhost:8000/wp-content/uploads/2024/01/a.webp')).toBe(
      '/media/wp-content/uploads/2024/01/a.webp',
    );
    expect(rewriteMediaUrl('http://localhost:8000/wp-content/avatars/7/128.jpg?v=3')).toBe(
      '/media/wp-content/avatars/7/128.jpg?v=3',
    );
  });

  it('passes through foreign and non-media URLs untouched', () => {
    expect(rewriteMediaUrl('https://secure.gravatar.com/avatar/abc')).toBe(
      'https://secure.gravatar.com/avatar/abc',
    );
    // A WP permalink is not media: leaving it absolute keeps it honest (and
    // the proxy would 404 it anyway).
    expect(rewriteMediaUrl('http://localhost:8000/2024/01/post-name/')).toBe(
      'http://localhost:8000/2024/01/post-name/',
    );
    expect(rewriteMediaUrl('')).toBe('');
  });
});

describe('rewriteSrcset', () => {
  it('rewrites every candidate URL and keeps descriptors', () => {
    expect(
      rewriteSrcset(
        'http://localhost:8000/wp-content/uploads/a-300x200.webp 300w, http://localhost:8000/wp-content/uploads/a.webp 1024w',
      ),
    ).toBe('/media/wp-content/uploads/a-300x200.webp 300w, /media/wp-content/uploads/a.webp 1024w');
  });
});

describe('media proxy target resolution', () => {
  it('accepts wp-content paths with or without trailing slash', () => {
    expect(resolveMediaTarget('/media/wp-content/uploads/2024/01/a.webp')).toBe(
      'http://localhost:8000/wp-content/uploads/2024/01/a.webp',
    );
    expect(resolveMediaTarget('/media/wp-content/uploads/2024/01/a.webp/')).toBe(
      'http://localhost:8000/wp-content/uploads/2024/01/a.webp',
    );
  });

  it('rejects traversal, wp-json, double-encoding, and foreign prefixes', () => {
    expect(resolveMediaTarget('/media/wp-content/uploads/../wp-config.php')).toBeNull();
    expect(resolveMediaTarget('/media/wp-content/uploads/%2e%2e/x')).toBeNull();
    expect(resolveMediaTarget('/media/%252e%252e/wp-config.php')).toBeNull();
    expect(resolveMediaTarget('/media/wp-json/aiya/core/v1/site')).toBeNull();
    expect(resolveMediaTarget('/media/themes/index.php')).toBeNull();
    expect(resolveMediaTarget('/media/wp-content/')).toBeNull();
  });

  it('serves single-encoded non-ASCII filenames after decoding', () => {
    // Chinese uploads arrive percent-encoded from the browser; validation
    // runs on the decoded path, which is exactly what is forwarded upstream.
    expect(
      resolveMediaTarget(
        '/media/wp-content/uploads/2026/09/%E5%B1%8F%E5%B9%95%E6%88%AA%E5%9B%BE-scaled.jpg',
      ),
    ).toBe('http://localhost:8000/wp-content/uploads/2026/09/屏幕截图-scaled.jpg');
  });
});

describe('proxyMedia', () => {
  it('streams the upstream file with shared-cache headers', async () => {
    const upstream = new Response('IMAGEBYTES', {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '10' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => upstream),
    );
    try {
      const response = await proxyMedia(
        '/media/wp-content/uploads/a.jpg',
        new Request('http://x/media/wp-content/uploads/a.jpg'),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      expect(response.headers.get('cache-control')).toBe('public, max-age=604800');
      await expect(response.text()).resolves.toBe('IMAGEBYTES');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forwards Range and rejects non-GET/HEAD', async () => {
    let seenRange: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        seenRange = new Headers(init?.headers).get('range');
        return new Response('PART', {
          status: 206,
          headers: { 'Content-Range': 'bytes 0-99/1000' },
        });
      }),
    );
    try {
      const request = new Request('http://x/media/wp-content/uploads/a.jpg', {
        headers: { Range: 'bytes=0-99' },
      });
      const response = await proxyMedia('/media/wp-content/uploads/a.jpg', request);
      expect(seenRange).toBe('bytes=0-99');
      expect(response.status).toBe(206);

      const post = new Request('http://x/media/wp-content/uploads/a.jpg', { method: 'POST' });
      const rejected = await proxyMedia('/media/wp-content/uploads/a.jpg', post);
      expect(rejected.status).toBe(405);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('safeContent media rewriting', () => {
  it('rewrites img src/srcset and link hrefs inside the sanitize pass', () => {
    const html =
      '<img src="http://localhost:8000/wp-content/uploads/2024/01/a.webp" srcset="http://localhost:8000/wp-content/uploads/a-300.webp 300w">' +
      '<a href="http://localhost:8000/wp-content/uploads/2024/01/file.pdf">下载</a>' +
      '<img src="https://cdn.example.com/foreign.png">';
    const cleaned = safeContent(html);
    expect(cleaned).toContain('src="/media/wp-content/uploads/2024/01/a.webp"');
    expect(cleaned).toContain('srcset="/media/wp-content/uploads/a-300.webp 300w"');
    expect(cleaned).toContain('href="/media/wp-content/uploads/2024/01/file.pdf"');
    expect(cleaned).toContain('loading="lazy"');
    expect(cleaned).toContain('https://cdn.example.com/foreign.png');
    expect(cleaned).not.toContain('localhost:8000');
  });
});

describe('cloakProfileMedia', () => {
  it('cloaks both avatar URLs in the owner projection, other fields untouched', () => {
    expect(
      cloakProfileMedia({
        id: 7,
        nickname: 'tester',
        avatar: {
          url: 'http://localhost:8000/wp-content/aiya_thumbnail/avatars/7/128.jpg',
          thumbUrl: 'http://localhost:8000/wp-content/aiya_thumbnail/avatars/7/64.jpg',
        },
      }),
    ).toEqual({
      id: 7,
      nickname: 'tester',
      avatar: {
        url: '/media/wp-content/aiya_thumbnail/avatars/7/128.jpg',
        thumbUrl: '/media/wp-content/aiya_thumbnail/avatars/7/64.jpg',
      },
    });
  });

  it('leaves foreign (gravatar) avatar hosts untouched', () => {
    const user = {
      avatar: {
        url: 'https://secure.gravatar.com/avatar/abc',
        thumbUrl: 'https://secure.gravatar.com/avatar/abc?s=64',
      },
    };
    expect(cloakProfileMedia(user)).toEqual(user);
  });
});

describe('client regression guard', () => {
  it('still rejects non-contract base URLs', () => {
    expect(() => createAiyaClient({ baseUrl: 'https://wp.example.com/wp-json/' })).toThrow(
      AiyaApiError,
    );
  });
});
