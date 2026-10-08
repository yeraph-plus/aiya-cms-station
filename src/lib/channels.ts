import type { z } from 'zod';
import type { channelPostSchema, channelTextEntitySchema } from '@/lib/core/contracts';
import { normalizeKeyword, searchPath } from '@/lib/search';

export type ChannelPost = z.infer<typeof channelPostSchema>;
export type ChannelTextEntity = z.infer<typeof channelTextEntitySchema>;
export type ChannelPostMedia = ChannelPost['media'][number];

/**
 * Telegram channel mirror rendering (pure logic — safe for SSR or islands):
 * rows → album groups (contracts.ts: consecutive rows sharing mediaGroupId
 * are one album) and text + entity spans → flat styled blocks. Offsets are
 * UTF-16 code units into `text`, so JS slices natively.
 */

export interface ChannelGroup {
  groupId: string | null;
  rows: ChannelPost[];
}

/** The feed groups CONSECUTIVE rows only — a repeated mediaGroupId after a
    gap starts a new album. */
export function groupChannelRows(rows: readonly ChannelPost[]): ChannelGroup[] {
  const groups: ChannelGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (row.mediaGroupId !== null && last !== undefined && last.groupId === row.mediaGroupId) {
      last.rows.push(row);
    } else {
      groups.push({ groupId: row.mediaGroupId, rows: [row] });
    }
  }
  return groups;
}

/** The masonry grid geometry for a merged album of `count` images — the
    single source both the renderer (its grid-template class) and the
    height estimator (cell math) derive from, so they cannot drift. */
export function mediaGridLayout(count: number): { cols: number; rows: number } {
  const cols =
    count === 1
      ? 1
      : count === 2 || count === 4
        ? 2
        : count === 5
          ? 6
          : count === 7 || count === 8
            ? 4
            : 3;
  const rows = count === 5 ? 2 : Math.ceil(count / cols);
  return { cols, rows };
}

/** Estimated card height in px-ish units (heuristic constants — media is
    exact from the contract's width/height, text is a width-weighted line
    wrap). Only COMPARISONS between cards drive placement, so drift in the
    absolute numbers costs balance, never correctness. */
const LINE_PX = 23;
const HEADER_PX = 34;
const PADDING_PX = 32;
const MEDIA_GAP_PX = 12;
const CJK_PX = 14.5;
const NARROW_PX = 8;
const COLUMN_WIDTH_PX: Record<number, number> = { 1: 1400, 2: 690, 3: 456 };

const isWideChar = (char: string): boolean => {
  const code = char.codePointAt(0)!;
  return code >= 0x1100 && !(code >= 0x2000 && code <= 0x206f);
};

/** Pre-computed card height for shortest-column packing: pure in (group,
    columnCount), so re-running the pack over a grown feed reproduces every
    earlier placement exactly — pagination never moves a placed card. */
export function estimateChannelCardHeight(group: ChannelGroup, columnCount: number): number {
  const width = COLUMN_WIDTH_PX[columnCount] ?? COLUMN_WIDTH_PX[3]!;
  const head = group.rows[0]!;
  let height = HEADER_PX + PADDING_PX;
  if (head.text !== '') {
    const capacity = width / CJK_PX;
    let lines = 0;
    for (const line of head.text.split('\n')) {
      let units = 0;
      for (const char of line) units += isWideChar(char) ? 1 : NARROW_PX / CJK_PX;
      lines += Math.max(1, Math.ceil(units / capacity));
    }
    height += lines * LINE_PX;
  }
  const media = group.rows.flatMap((row) => row.media);
  if (media.length > 0) {
    height += MEDIA_GAP_PX;
    if (media.length === 1) {
      height += (width * 9) / 16; // the single-image aspect-video slot
    } else {
      const { cols, rows } = mediaGridLayout(media.length);
      height += (rows * width) / cols; // square cells
    }
  }
  return height;
}

/** Greedy shortest-column packing: each card lands on the currently
    shallowest column (ties → lowest index, deterministic). Because the
    assignment of card k depends only on cards 0..k-1, re-packing a grown
    feed is prefix-stable — earlier placements never move. */
export function packColumns(heights: readonly number[], count: number): number[] {
  const columns = Math.max(1, count);
  const totals = new Array<number>(columns).fill(0);
  const assign: number[] = [];
  heights.forEach((height) => {
    let target = 0;
    for (let column = 1; column < columns; column++) {
      if (totals[column]! < totals[target]!) target = column;
    }
    assign.push(target);
    totals[target]! += height;
  });
  return assign;
}

/** One leaf run of text under one covering-span set. `href` comes from the
    best-ranked link-ish span covering the segment (link > url >
    mention/hashtag). */
export interface ChannelLeaf {
  text: string;
  styles: string[];
  href: string | null;
}

/** Inline spans resolve into paragraph blocks; TG's block-level pre and
    blockquote entities each open a block of their own kind, and adjacent
    same-kind segments merge into one block. */
export interface ChannelBlock {
  block: 'p' | 'pre' | 'blockquote';
  leaves: ChannelLeaf[];
}

interface SegSpan {
  type: string;
  url: string | null;
  start: number;
  end: number;
}

/** A bare 'url' span links to itself; a protocol-less slice gets https://
    (Telegram emits "www.example.com" forms). Non-http(s) schemes never
    become links. */
function safeSelfUrl(raw: string): string | null {
  for (const candidate of [raw, `https://${raw}`]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch {
      // Not a URL in this form — try the next candidate.
    }
  }
  return null;
}

/** 'mention' spans carry no resolvable web target of their own — they link
    into the site's own search so the tag stays useful on-site. Hashtags do
    NOT resolve to a href here: the island renders them as a search-box
    fill button (blue styling, click → in-page filter), so the resolver
    keeps them pure decoration. */
function siteSearchUrl(raw: string): string | null {
  const key = normalizeKeyword(raw);
  return key === '' ? null : searchPath(key);
}

/** href rank per type; within one rank the innermost span (later in the
    outermost-first covering order) wins. Hashtags stay linkless — the
    island turns them into search-box fill buttons. */
const HREF_RANK: Record<string, number> = { link: 3, url: 2, mention: 1 };

function pickHref(covering: readonly SegSpan[], text: string): string | null {
  let best: { rank: number; href: string } | null = null;
  for (const span of covering) {
    const rank = HREF_RANK[span.type];
    if (rank === undefined) continue;
    // The raw text comes from the SPAN's window, not the segment's: a
    // styling span splitting a URL or a tag must not break the target —
    // every covered segment links the full entity text.
    const raw = text.slice(span.start, span.end);
    const href =
      span.type === 'link' ? span.url : span.type === 'url' ? safeSelfUrl(raw) : siteSearchUrl(raw);
    if (href !== null && (best === null || rank >= best.rank)) best = { rank, href };
  }
  return best?.href ?? null;
}

/**
 * Resolve one row's text + entities into render blocks by boundary-point
 * segmentation: every span boundary cuts the text, and each segment between
 * adjacent boundaries carries the set of spans fully covering it — overlaps
 * and nesting render stacked instead of being dropped by a tree walk.
 * Spans are clamped to the text, so the joined leaf text ALWAYS equals the
 * source (the mirror never loses content over styling). An empty entity
 * list degrades to one plain paragraph.
 */
export function resolveChannelBlocks(
  text: string,
  entities: readonly ChannelTextEntity[],
): ChannelBlock[] {
  const len = text.length;
  if (len === 0) return [];

  const spans: SegSpan[] = [];
  for (const entity of entities) {
    if (entity.length <= 0) continue;
    const start = Math.max(0, Math.min(entity.offset, len));
    const end = Math.max(start, Math.min(entity.offset + entity.length, len));
    if (end > start) spans.push({ type: entity.type, url: entity.url, start, end });
  }
  if (spans.length === 0) {
    return [{ block: 'p', leaves: [{ text, styles: [], href: null }] }];
  }

  // 0 and len anchor the tile even when no span touches the edges.
  const points = [...new Set(spans.flatMap((span) => [span.start, span.end]))];
  points.push(0, len);
  points.sort((a, b) => a - b);

  const blocks: ChannelBlock[] = [];
  const pushLeaf = (
    block: ChannelBlock['block'],
    styles: readonly string[],
    href: string | null,
    from: number,
    to: number,
  ) => {
    if (to <= from) return;
    const last = blocks[blocks.length - 1];
    if (last === undefined || last.block !== block) blocks.push({ block, leaves: [] });
    blocks[blocks.length - 1]!.leaves.push({
      text: text.slice(from, to),
      styles: [...styles],
      href,
    });
  };

  for (let i = 0; i + 1 < points.length; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const covering = spans
      .filter((span) => span.start <= from && span.end >= to)
      .sort((a, b) => a.start - b.start || b.end - a.end); // outermost first
    const block: ChannelBlock['block'] = covering.some((span) => span.type === 'pre')
      ? 'pre'
      : covering.some((span) => span.type === 'blockquote')
        ? 'blockquote'
        : 'p';
    const styles = [
      ...new Set(
        covering.map((span) => span.type).filter((type) => type !== 'pre' && type !== 'blockquote'),
      ),
    ];
    pushLeaf(block, styles, pickHref(covering, text), from, to);
  }
  return blocks;
}
