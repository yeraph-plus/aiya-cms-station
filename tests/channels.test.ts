import { describe, expect, it } from 'vitest';

import {
  estimateChannelCardHeight,
  groupChannelRows,
  mediaGridLayout,
  packColumns,
  resolveChannelBlocks,
  type ChannelGroup,
  type ChannelPost,
  type ChannelTextEntity,
} from '@/lib/channels';

function row(overrides: Partial<ChannelPost>): ChannelPost {
  return {
    id: 1,
    kind: 'text',
    text: '',
    entities: [],
    media: [],
    channel: { id: -1001234567890, title: 'Example', username: 'example', nsfw: false },
    tgLink: 'https://t.me/example/1',
    mediaGroupId: null,
    postedAt: '2026-10-07T00:00:00+00:00',
    ...overrides,
  };
}

function entity(overrides: Partial<ChannelTextEntity>): ChannelTextEntity {
  return { type: 'bold', offset: 0, length: 1, url: null, ...overrides };
}

function groupOf(post: ChannelPost): ChannelGroup {
  return { groupId: null, rows: [post] };
}

function leafText(blocks: ReturnType<typeof resolveChannelBlocks>): string {
  return blocks.map((block) => block.leaves.map((leaf) => leaf.text).join('')).join('');
}

describe('groupChannelRows', () => {
  it('merges only CONSECUTIVE rows sharing mediaGroupId', () => {
    const groups = groupChannelRows([
      row({ id: 4, mediaGroupId: 'a' }),
      row({ id: 3, mediaGroupId: 'a' }),
      row({ id: 2, text: 'interrupting text post', mediaGroupId: null }),
      row({ id: 1, mediaGroupId: 'a' }),
    ]);
    expect(groups.map((group) => group.rows.map((row) => row.id))).toEqual([[4, 3], [2], [1]]);
    expect(groups.every((group) => group.groupId !== null || group.rows.length === 1)).toBe(true);
  });

  it('keeps null-group and singleton rows one per group, order preserved', () => {
    const groups = groupChannelRows([
      row({ id: 2, mediaGroupId: null }),
      row({ id: 1, mediaGroupId: 'x' }),
    ]);
    expect(groups.map((group) => group.groupId)).toEqual([null, 'x']);
    expect(groups.map((group) => group.rows.length)).toEqual([1, 1]);
  });
});

describe('mediaGridLayout', () => {
  it('matches the album grid recipes cell-for-cell (render and estimator share it)', () => {
    expect(mediaGridLayout(1)).toEqual({ cols: 1, rows: 1 });
    expect(mediaGridLayout(2)).toEqual({ cols: 2, rows: 1 });
    expect(mediaGridLayout(4)).toEqual({ cols: 2, rows: 2 });
    expect(mediaGridLayout(5)).toEqual({ cols: 6, rows: 2 }); // the 3+2 span recipe
    expect(mediaGridLayout(7)).toEqual({ cols: 4, rows: 2 });
    expect(mediaGridLayout(9)).toEqual({ cols: 3, rows: 3 });
    expect(mediaGridLayout(10)).toEqual({ cols: 3, rows: 4 });
  });
});

describe('estimateChannelCardHeight', () => {
  const mediaRow = (count: number): ChannelPost =>
    row({
      text: '',
      media: Array.from({ length: count }, (_, index) => ({
        url: `https://aiya.test/${index}.jpg`,
        width: 800,
        height: 800,
      })),
    });

  it('a text-only card grows with line wraps, CJK wraps sooner than latin', () => {
    const base = estimateChannelCardHeight(groupOf(row({ text: '' })), 3);
    expect(estimateChannelCardHeight(groupOf(row({ text: '一'.repeat(40) })), 3)).toBeGreaterThan(
      base,
    );
    expect(estimateChannelCardHeight(groupOf(row({ text: '一'.repeat(200) })), 3)).toBeGreaterThan(
      estimateChannelCardHeight(groupOf(row({ text: '一'.repeat(40) })), 3),
    );
    // 40 full-width glyphs fill more of the 3-column measure than 40 narrow ones.
    expect(estimateChannelCardHeight(groupOf(row({ text: 'a'.repeat(40) })), 3)).toBeLessThan(
      estimateChannelCardHeight(groupOf(row({ text: '一'.repeat(40) })), 3),
    );
  });

  it('media adds contract-derived height: the ten-image album rides four rows', () => {
    const base = estimateChannelCardHeight(groupOf(row({ text: '' })), 3);
    expect(estimateChannelCardHeight(groupOf(mediaRow(1)), 3)).toBeGreaterThan(base);
    expect(estimateChannelCardHeight(groupOf(mediaRow(10)), 3)).toBeGreaterThan(
      estimateChannelCardHeight(groupOf(mediaRow(2)), 3),
    );
  });
});

describe('packColumns', () => {
  it('greedily places each card on the currently shortest column', () => {
    expect(packColumns([5, 1, 1, 1], 2)).toEqual([0, 1, 1, 1]);
  });

  it('ties resolve to the lowest column index (deterministic)', () => {
    expect(packColumns([1, 1, 1], 3)).toEqual([0, 1, 2]);
  });

  it('re-packing a grown feed is prefix-stable: a placed card never moves', () => {
    const heights = [3, 1, 4, 1, 5, 9, 2, 6];
    const before = packColumns(heights.slice(0, 4), 3);
    const after = packColumns(heights, 3);
    before.forEach((column, index) => expect(after[index]).toBe(column));
  });

  it('degenerate count packs everything into one column', () => {
    expect(packColumns([1, 2, 3], 0)).toEqual([0, 0, 0]);
  });
});

describe('resolveChannelBlocks', () => {
  it('a row without entities renders as one plain paragraph (plain-text fallback)', () => {
    const blocks = resolveChannelBlocks('plain text', []);
    expect(blocks).toEqual([
      { block: 'p', leaves: [{ text: 'plain text', styles: [], href: null }] },
    ]);
  });

  it('splits plain → styled → plain around an inline span', () => {
    const blocks = resolveChannelBlocks('ab cd', [entity({ type: 'bold', offset: 3, length: 2 })]);
    expect(blocks[0]!.leaves.map((leaf) => [leaf.text, leaf.styles])).toEqual([
      ['ab ', []],
      ['cd', ['bold']],
    ]);
  });

  it('nests a link inside bold: style chain composes, the link wins href', () => {
    const blocks = resolveChannelBlocks('abcd', [
      entity({ type: 'bold', offset: 0, length: 4 }),
      entity({ type: 'link', offset: 1, length: 2, url: 'https://x.example/' }),
    ]);
    expect(blocks[0]!.leaves).toEqual([
      { text: 'a', styles: ['bold'], href: null },
      { text: 'bc', styles: ['bold', 'link'], href: 'https://x.example/' },
      { text: 'd', styles: ['bold'], href: null },
    ]);
  });

  it('renders partial overlaps as stacked covering sets instead of dropping them', () => {
    const text = 'abcdef';
    const blocks = resolveChannelBlocks(text, [
      entity({ type: 'bold', offset: 1, length: 4 }), // 1–5
      entity({ type: 'italic', offset: 2, length: 5 }), // 2–7, clamped to 2–6
      entity({ type: 'bold', offset: 4, length: 99 }), // 4–6, clamped to the end
      entity({ type: 'italic', offset: 99, length: 5 }), // empty after clamp → dropped
    ]);
    expect(leafText(blocks)).toBe(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.leaves.map((leaf) => leaf.styles)).toEqual([
      [],
      ['bold'],
      ['bold', 'italic'],
      ['bold', 'italic'],
      ['italic', 'bold'],
    ]);
  });

  it('a mention span links into the site search with its raw text', () => {
    const blocks = resolveChannelBlocks('hi @aiya_cms!', [
      entity({ type: 'mention', offset: 3, length: 9 }),
    ]);
    expect(blocks[0]!.leaves).toEqual([
      { text: 'hi ', styles: [], href: null },
      { text: '@aiya_cms', styles: ['mention'], href: '/search/%40aiya_cms/' },
      { text: '!', styles: [], href: null },
    ]);
  });

  it('a hashtag span stays a linkless styled decoration (the island fills the search box on click)', () => {
    const blocks = resolveChannelBlocks('tag #aiya end', [
      entity({ type: 'hashtag', offset: 4, length: 5 }),
    ]);
    expect(blocks[0]!.leaves[1]).toEqual({
      text: '#aiya',
      styles: ['hashtag'],
      href: null,
    });
  });

  it('a bare url span links to itself, http(s) only', () => {
    const blocks = resolveChannelBlocks('see https://y.example/ end', [
      entity({ type: 'url', offset: 4, length: 18 }),
    ]);
    const leaf = blocks[0]!.leaves.find((leaf) => leaf.href !== null)!;
    expect(leaf.href).toBe('https://y.example/');
    expect(leaf.styles).toContain('url');
  });

  it('a protocol-less url span gets https:// prepended', () => {
    const blocks = resolveChannelBlocks('see example.com/x end', [
      entity({ type: 'url', offset: 4, length: 13 }),
    ]);
    const leaf = blocks[0]!.leaves.find((leaf) => leaf.href !== null)!;
    expect(leaf.href).toBe('https://example.com/x');
  });

  it('an explicit link outranks a covering url span for the shared segment', () => {
    const blocks = resolveChannelBlocks('abcdefghij', [
      entity({ type: 'url', offset: 0, length: 10 }),
      entity({ type: 'link', offset: 2, length: 2, url: 'https://x.example/' }),
    ]);
    expect(blocks[0]!.leaves.map((leaf) => leaf.href)).toEqual([
      'https://abcdefghij/',
      'https://x.example/',
      'https://abcdefghij/',
    ]);
  });

  it('pre and blockquote entities open blocks of their own kind', () => {
    const blocks = resolveChannelBlocks('before code after', [
      entity({ type: 'pre', offset: 7, length: 4 }),
    ]);
    expect(blocks.map((block) => block.block)).toEqual(['p', 'pre', 'p']);
    expect(leafText(blocks)).toBe('before code after');
  });

  it('adjacent blockquote segments merge into one quote block', () => {
    const blocks = resolveChannelBlocks('abcdef', [
      entity({ type: 'blockquote', offset: 0, length: 3 }),
      entity({ type: 'blockquote', offset: 3, length: 3 }),
    ]);
    expect(blocks).toEqual([
      {
        block: 'blockquote',
        leaves: [
          { text: 'abc', styles: [], href: null },
          { text: 'def', styles: [], href: null },
        ],
      },
    ]);
  });

  it('the joined leaf text always equals the source text (content invariant)', () => {
    const text = 'The quick brown fox jumps';
    const blocks = resolveChannelBlocks(text, [
      entity({ type: 'spoiler', offset: 4, length: 5 }),
      entity({ type: 'code', offset: 10, length: 5 }),
      entity({ type: 'link', offset: 16, length: 5, url: 'https://z.example/' }),
    ]);
    expect(leafText(blocks)).toBe(text);
  });
});
