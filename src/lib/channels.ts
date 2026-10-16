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

/** The rows whose text a card renders, in order: EVERY row's non-empty text.
    An album is several rows and Telegram hangs the caption on whichever
    message carried it, so reading rows[0] alone drops a caption that rides a
    later row (it surfaced as "the images showed, the text was gone").
    Entities stay per row — the caller never re-bases offsets. */
export function channelGroupTexts(group: ChannelGroup): ChannelPost[] {
  return group.rows.filter((row) => row.text !== '');
}

/** The album grid geometry for a merged album of `count` images — the single
    source both renderers (their grid template) and the height estimator
    (cell math) derive from, so they cannot drift.

    Deliberate shape (2026-10-13, UX.md §3 图片区排布): one image fills the
    measure at its own ratio — never cropped, never height-capped, so long
    phone screenshots show whole; two sit side by side; three put one tall
    image beside a stacked pair; four is the 2×2 board; five and up ride the
    uniform three-column 九宫格. `shown` is how many tiles actually render —
    capped at nine, the caller covering the ninth with the +N overflow badge
    (the hidden tail still rides the lightbox). */
export function mediaGridLayout(count: number): {
  cols: number;
  rows: number;
  /** First tile spans both rows — the 3-image one-tall-left/two-right shape. */
  leadSpan: boolean;
  /** Tiles actually rendered: 9 once the album overflows the board. */
  shown: number;
} {
  const shown = Math.min(Math.max(count, 1), 9);
  const cols = shown <= 1 ? 1 : shown <= 4 ? 2 : 3;
  const rows = shown <= 2 ? 1 : Math.ceil(shown / cols);
  return { cols, rows, leadSpan: shown === 3, shown };
}

/** Grid-template classes per board shape — the renderers' template, derived
    from the same geometry so no island keeps its own copy of the recipe.
    Multi-image boards pin the container's aspect (cols : rows) with every
    cell on `1fr`, so the squares stay square AND no tile's own height can
    inflate a row — a long screenshot is cropped by its cell, never laid out
    at its intrinsic size. The single tile rides its own ratio instead. */
const COLS_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};
const ROWS_CLASS: Record<number, string> = {
  1: 'grid-rows-1',
  2: 'grid-rows-2',
  3: 'grid-rows-3',
};
const BOARD_ASPECT_CLASS: Record<string, string> = {
  '2x1': 'aspect-2/1',
  '2x2': 'aspect-square',
  '3x2': 'aspect-3/2',
  '3x3': 'aspect-square',
};

export function mediaGridClass(count: number): string {
  const { cols, rows, shown } = mediaGridLayout(count);
  return [
    COLS_CLASS[cols],
    shown > 1 ? ROWS_CLASS[rows] : '',
    BOARD_ASPECT_CLASS[`${cols}x${rows}`] ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Estimated card height in px-ish units (heuristic constants — media is
    exact from the contract's width/height, text is a width-weighted line
    wrap). Only COMPARISONS between cards drive placement, so drift in the
    absolute numbers costs balance, never correctness. */
const LINE_PX = 23;
const HEADER_PX = 34;
const PADDING_PX = 32;
const MEDIA_GAP_PX = 12;
const TEXT_GAP_PX = 8; // the mt-2 between stacked text rows
const CJK_PX = 14.5;
const NARROW_PX = 8;
const COLUMN_WIDTH_PX: Record<number, number> = { 1: 1400, 2: 690, 3: 456 };

const isWideChar = (char: string): boolean => {
  const code = char.codePointAt(0)!;
  return code >= 0x1100 && !(code >= 0x2000 && code <= 0x206f);
};

/** Height ÷ width for one media item — the contract's dimensions are exact;
    dimension-less media falls back to a 4:3 placeholder. */
function mediaAspect(item: ChannelPostMedia): number {
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  return w > 0 && h > 0 ? h / w : 3 / 4;
}

/** Pre-computed card height for shortest-column packing: pure in (group,
    columnCount), so re-running the pack over a grown feed reproduces every
    earlier placement exactly — pagination never moves a placed card. */
export function estimateChannelCardHeight(group: ChannelGroup, columnCount: number): number {
  const width = COLUMN_WIDTH_PX[columnCount] ?? COLUMN_WIDTH_PX[3]!;
  let height = HEADER_PX + PADDING_PX;
  for (const [index, row] of channelGroupTexts(group).entries()) {
    if (index > 0) height += TEXT_GAP_PX; // stacked rows keep the block gap
    const capacity = width / CJK_PX;
    let lines = 0;
    for (const line of row.text.split('\n')) {
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
      // The single tile renders at the image's own ratio (never cropped):
      // the contract's dimensions are the real measure, the fallback only
      // covers media the source posted without them.
      height += width * mediaAspect(media[0]!);
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
