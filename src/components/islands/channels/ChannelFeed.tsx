import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SearchIcon } from 'lucide-react';

import Lightbox from 'yet-another-react-lightbox';

import { lightboxChrome, lightboxPlugins } from '@/lib/lightbox';

import EmptyNote from '@/components/islands/EmptyNote';
import Spinner from '@/components/islands/Spinner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  estimateChannelCardHeight,
  mediaGridLayout,
  packColumns,
  resolveChannelBlocks,
  type ChannelGroup,
  type ChannelLeaf,
  type ChannelPostMedia,
  type ChannelTextEntity,
} from '@/lib/channels';
import type { Pagination } from '@/lib/core/contracts';
import { displayDate } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';

type PageMeta = Pick<Pagination, 'page' | 'totalPages' | 'hasNext' | 'hasPrevious'>;

interface Props {
  /** Page 1 as album groups, media already cloaked (Astro shapes the
   *  data; this island only renders and appends). */
  initialGroups: ChannelGroup[];
  initialPagination: PageMeta;
  locale: Locale;
  /** Site calendar timezone (from /site); displayDate renders dates in it. */
  timezone: string;
  /** The visitor's NSFW soft switch (SSR cookie state): on, sensitive
   *  channel media renders unblurred; off (default), blurred behind a
   *  click-to-reveal cover. */
  showNsfw: boolean;
}

/** One styling span's utility classes — kept visually identical to the
 *  community renderer's inline marks (native strong/em/u/s semantics, the
 *  shell's shared .spoiler recipe, bare font-mono code — preflight parity,
 *  no channel-local chip). The link-ish types (link / url / mention)
 *  resolve to hrefs in the resolver and render through the anchor branch,
 *  which carries the accent color itself; hashtags render as the
 *  search-box fill buttons below. */
const LEAF_CLASS: Record<string, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'line-through',
  code: 'font-mono',
  spoiler: 'spoiler',
};

const BLOCK_CLASS = {
  p: 'whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground',
  pre: 'whitespace-pre-wrap break-words rounded-md bg-canvas p-3 font-mono text-sm text-foreground',
  // Community quote recipe: full-strength --border edge, soft text.
  blockquote: 'border-l-2 border-border pl-3 text-sm text-body-muted',
} as const;

function Leaf({ leaf, onTag }: { leaf: ChannelLeaf; onTag?: (tag: string) => void }) {
  // Hashtags are in-page search fills, never navigation: blue button that
  // drops the tag into the toolbar's search box (resolver keeps them
  // linkless, so a covering link's href can never be hijacked here).
  if (leaf.styles.includes('hashtag')) {
    if (onTag !== undefined) {
      return (
        <button
          type="button"
          onClick={() => onTag(leaf.text)}
          className="text-focus-blue hover:underline focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          {leaf.text}
        </button>
      );
    }
    return <span className="text-focus-blue">{leaf.text}</span>;
  }
  const cls = [...new Set(leaf.styles)]
    .map((style) => LEAF_CLASS[style] ?? '')
    .filter(Boolean)
    .join(' ');
  if (leaf.href !== null) {
    return (
      <a
        href={leaf.href}
        target="_blank"
        rel="noreferrer"
        className={`${cls} text-focus-blue hover:underline focus-visible:outline-2 focus-visible:outline-focus-blue`}
      >
        {leaf.text}
      </a>
    );
  }
  if (cls !== '') {
    return (
      <span className={cls} {...(leaf.styles.includes('spoiler') ? { tabIndex: 0 } : {})}>
        {leaf.text}
      </span>
    );
  }
  return <>{leaf.text}</>;
}

/** One row's text + entity spans as flat styled blocks. `text` is plain
    text — entities decorate it, nothing renders as HTML. */
function ChannelText({
  text,
  entities,
  onTag,
}: {
  text: string;
  entities: ChannelTextEntity[];
  onTag?: (tag: string) => void;
}) {
  const blocks = resolveChannelBlocks(text, entities);
  return (
    <>
      {blocks.map((block, index) => {
        const Tag = block.block;
        return (
          <Tag
            key={index}
            className={[BLOCK_CLASS[block.block], index > 0 && 'mt-2'].filter(Boolean).join(' ')}
          >
            {block.leaves.map((leaf, leafIndex) => (
              <Leaf key={leafIndex} leaf={leaf} onTag={onTag} />
            ))}
          </Tag>
        );
      })}
    </>
  );
}

/** Column template per image count — derived from the shared album
 *  geometry (lib/channels mediaGridLayout, also feeding the height
 *  estimator, so render and packing can never drift): 1 large, 2/3 in a
 *  row, 4 as 2×2, 5 as 3+2, 6 as 2×3, 7/8 in four columns, 9+ as the
 *  3-col wall (a Telegram album can ride ten — the mirror never drops
 *  media). */
const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  6: 'grid-cols-6',
};
const imageGridClass = (count: number): string =>
  GRID_CLASS[mediaGridLayout(count).cols] ?? 'grid-cols-3';

/** The card's dedicated image area: the group's merged album media in the
 *  count-aware grid; clicking opens the shared lightbox at that index.
 *  Sensitive (NSFW-channel) media renders blurred behind a full-cover
 *  reveal button — the blurred images ignore the pointer so the lightbox
 *  stays unreachable until revealed. */
function MediaGrid({
  media,
  sensitive,
  revealLabel,
  onOpen,
  onReveal,
}: {
  media: ChannelPostMedia[];
  sensitive: boolean;
  revealLabel: string;
  onOpen: (index: number) => void;
  onReveal: () => void;
}) {
  const count = media.length;
  const five = count === 5;
  return (
    <div
      className={`relative mt-3 grid gap-0.5 overflow-hidden rounded-lg border border-border ${imageGridClass(count)}`}
    >
      {media.map((item, index) => {
        const layout =
          count === 1
            ? 'aspect-video w-full object-cover'
            : five
              ? `aspect-square w-full object-cover ${index < 3 ? 'col-span-2' : 'col-span-3'}`
              : 'aspect-square w-full object-cover';
        return (
          <img
            key={item.url + index}
            src={item.url}
            width={item.width}
            height={item.height}
            alt=""
            loading="lazy"
            decoding="async"
            onClick={() => onOpen(index)}
            className={`${
              sensitive ? 'pointer-events-none blur-2xl ' : 'cursor-zoom-in '
            }${layout}`}
          />
        );
      })}
      {sensitive && (
        <button
          type="button"
          onClick={onReveal}
          aria-label={revealLabel}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-focus-blue"
        >
          <span className="rounded-full border border-border bg-canvas/90 px-3 py-1 text-xs text-foreground">
            {revealLabel}
          </span>
        </button>
      )}
    </div>
  );
}

/** Column count mirrors the shell's Tailwind breakpoints exactly (sm
 *  40rem / lg 64rem) so the JS split and the CSS scale can never drift —
 *  rem units keep user font-size scaling in lockstep. Null until measured:
 *  SSR and the first client render mask the wall behind the loading
 *  spinner instead of flashing the one-column stack that the real layout
 *  would immediately re-pack. */
function useColumnCount(): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const sm = window.matchMedia('(min-width: 40rem)');
    const lg = window.matchMedia('(min-width: 64rem)');
    const compute = () => setCount(lg.matches ? 3 : sm.matches ? 2 : 1);
    compute();
    sm.addEventListener('change', compute);
    lg.addEventListener('change', compute);
    return () => {
      sm.removeEventListener('change', compute);
      lg.removeEventListener('change', compute);
    };
  }, []);
  return count;
}

/** One message card: the album head's styled text plus the group's merged
 *  media area. Header: the bold channel name linking to the t.me permalink
 *  on the left, the post date on the right (a not-yet-filled title degrades
 *  to a bare date). NSFW-channel media renders blurred (unless the
 *  visitor's soft switch is on) behind a click-to-reveal cover. */
function ChannelCard({
  group,
  locale,
  timezone,
  showNsfw,
  onOpen,
  onTag,
}: {
  group: ChannelGroup;
  locale: Locale;
  timezone: string;
  showNsfw: boolean;
  onOpen: (media: ChannelPostMedia[], index: number) => void;
  onTag: (tag: string) => void;
}) {
  const copy = t(locale).channels;
  const head = group.rows[0]!;
  const media = group.rows.flatMap((row) => row.media);
  const [revealed, setRevealed] = useState(false);
  const sensitive = head.channel.nsfw && !showNsfw;
  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <header className="mb-2 flex items-center justify-between gap-3 text-sm text-body-muted">
        {head.channel.title !== '' ? (
          <a
            href={head.tgLink}
            target="_blank"
            rel="noreferrer"
            title={copy.viewOnTelegram}
            className="min-w-0 truncate font-bold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-focus-blue"
          >
            {head.channel.title}
          </a>
        ) : (
          <span />
        )}
        <time dateTime={head.postedAt} className="shrink-0">
          {displayDate(head.postedAt, locale, timezone)}
        </time>
      </header>
      <div className="min-w-0">
        <ChannelText text={head.text} entities={head.entities} onTag={onTag} />
        {media.length > 0 && (
          <MediaGrid
            media={media}
            sensitive={sensitive && !revealed}
            revealLabel={copy.revealSensitive}
            onOpen={(index) => onOpen(media, index)}
            onReveal={() => setRevealed(true)}
          />
        )}
      </div>
    </article>
  );
}

/**
 * The channel mirror island: a masonry card wall (one column on mobile,
 * two at sm, three at lg) with sentinel auto-load. Each batch of card
 * heights is pre-computed (estimateChannelCardHeight — media exact from
 * the contract's aspect ratios, text width-weighted) and packed greedily
 * moves. Astro fetched and shaped page 1; further pages come pre-grouped
 * from the same-origin /api/channels proxy, so this component only
 * renders and appends. Read-only surface — the channel is the single
 * source of truth; hashtags fill the toolbar's search box in-page, and
 * sensitive (NSFW-channel) media blurs behind a click-to-reveal cover
 * unless the visitor's soft switch is on.
 */
export default function ChannelFeed({
  initialGroups,
  initialPagination,
  locale,
  timezone,
  showNsfw,
}: Props) {
  const copy = t(locale).channels;
  const [groups, setGroups] = useState(initialGroups);
  const [pagination, setPagination] = useState(initialPagination);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Filter toolbar state: Select value ('all' or the channel id string)
   *  plus the input text and its debounced effective keyword. */
  const [channelValue, setChannelValue] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<number | null>(null);
  /** Single-flight slot plus a sequence guard shared by the filter fetch
   *  and the auto-append: a late stale response must never write into
   *  newer feed state. */
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const paginationRef = useRef(pagination);
  paginationRef.current = pagination;
  /** Latest rendered filter context for the append path (a ref stays
   *  current across the callbacks' closures). */
  const filterRef = useRef({ channelId: '', search: '' });
  filterRef.current = { channelId: channelValue === 'all' ? '' : channelValue, search };
  /** Queue slot: a filter click landing while another fetch runs wins the
   *  slot afterwards — the newest filter context is authoritative. */
  const queuedRef = useRef<{ channelId: string; search: string } | null>(null);

  /** Filter/search fetch: one fresh page-1 replace of the wall. */
  const fetchFeed = useCallback(async (nextChannel: string, nextSearch: string) => {
    if (busyRef.current) {
      queuedRef.current = { channelId: nextChannel, search: nextSearch };
      return;
    }
    busyRef.current = true;
    const seq = ++seqRef.current;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams();
      if (nextChannel !== '') params.set('channelId', nextChannel);
      if (nextSearch !== '') params.set('search', nextSearch);
      const response = await fetch(`/api/channels/${params.size > 0 ? `?${params}` : ''}`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        groups?: ChannelGroup[];
        pagination?: PageMeta;
      } | null;
      if (seq !== seqRef.current) return;
      if (json?.ok && json.groups && json.pagination) {
        setGroups(json.groups);
        setPagination(json.pagination);
      }
    } catch {
      // Network-level rejection: keep the current feed; the next filter
      // change retries anyway.
    } finally {
      busyRef.current = false;
      const queued = queuedRef.current;
      queuedRef.current = null;
      if (queued) void fetchFeed(queued.channelId, queued.search);
      else if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  const onChannelChange = (value: string) => {
    setChannelValue(value);
    void fetchFeed(value === 'all' ? '' : value, search);
  };

  /** Keyword filter: the input updates now, the fetch debounces (400ms —
   *  the community toolbar's cadence). */
  const onSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setSearch(value);
      void fetchFeed(channelValue === 'all' ? '' : channelValue, value);
    }, 400);
  };

  /** Hashtag click: fill the toolbar's search box with the tag's own text
   *  and filter immediately (no debounce — the click is the intent). */
  const onTag = (tag: string) => {
    setSearchInput(tag);
    setSearch(tag);
    void fetchFeed(channelValue === 'all' ? '' : channelValue, tag);
  };

  useEffect(
    () => () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    },
    [],
  );

  const appendNext = useCallback(() => {
    if (busyRef.current || !paginationRef.current.hasNext) return;
    busyRef.current = true;
    const seq = ++seqRef.current;
    setLoading(true);
    setFailed(false);
    void (async () => {
      let ok = false;
      try {
        const next = paginationRef.current.page + 1;
        const params = new URLSearchParams({ page: String(next) });
        if (filterRef.current.channelId !== '')
          params.set('channelId', filterRef.current.channelId);
        if (filterRef.current.search !== '') params.set('search', filterRef.current.search);
        const response = await fetch(`/api/channels/?${params}`);
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          groups?: ChannelGroup[];
          pagination?: PageMeta;
        } | null;
        if (seq !== seqRef.current) return;
        if (json?.ok && json.groups && json.pagination) {
          ok = true;
          setGroups((prev) => [...prev, ...json.groups!]);
          setPagination(json.pagination);
        }
      } catch {
        // Network-level rejection: keep the page cursor; the footer's
        // retry affordance and the hook's backoff both re-attempt.
      } finally {
        busyRef.current = false;
        if (seq === seqRef.current) {
          setLoading(false);
          setFailed(!ok);
        }
        rearm(ok);
      }
    })();
  }, []);

  const { sentinelRef, rearm } = useInfiniteScroll({ enabled: true, start: appendNext });
  const columnCount = useColumnCount();

  /** Channel picker options: the identities seen across loaded pages — the
   *  mirror aggregates a handful of source channels, page 1 covers them. */
  const channels = useMemo(() => {
    const seen = new Map<number, string>();
    for (const group of groups) {
      const channel = group.rows[0]!.channel;
      if (channel.title !== '' && !seen.has(channel.id)) seen.set(channel.id, channel.title);
    }
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [groups]);

  const [lightbox, setLightbox] = useState<{
    open: boolean;
    index: number;
    images: { src: string }[];
  }>({ open: false, index: 0, images: [] });
  const openLightbox = (media: ChannelPostMedia[], index: number) =>
    setLightbox({
      open: true,
      index,
      images: media.map((item) => ({ src: item.url })),
    });

  /** Estimated-height shortest-column packing: recomputes over the whole
   *  feed on append/resize, but the pure (estimate, pack) pair makes every
   *  earlier placement a fixed point — only new cards choose columns.
   *  Unmeasured viewports (pre-hydration) pack nothing — the wall stays
   *  masked until the real column count lands. */
  const columns = useMemo(() => {
    if (columnCount === null) return [];
    const assign = packColumns(
      groups.map((group) => estimateChannelCardHeight(group, columnCount)),
      columnCount,
    );
    const packed: ChannelGroup[][] = Array.from({ length: Math.max(1, columnCount) }, () => []);
    groups.forEach((group, index) => packed[assign[index]!]!.push(group));
    return packed;
  }, [groups, columnCount]);

  return (
    <div>
      {/* Filter toolbar, one row at the top: source-channel picker plus the
          keyword search box; both drive a fresh page-1 replace through the
          same-origin proxy. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={channelValue} onValueChange={onChannelChange}>
          <SelectTrigger
            size="sm"
            className="w-[150px] shrink-0 bg-surface text-xs font-normal"
            aria-label={copy.allChannels}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.allChannels}</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={String(channel.id)}>
                {channel.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-52">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-body-muted"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchPlaceholder}
            className="h-8 bg-surface pl-8 text-xs"
          />
        </div>
      </div>

      {columnCount === null ? (
        /* Masked until measured: the one-column stack the SSR fallback
           would show is exactly what the real layout re-packs away. */
        <div className="py-16 text-center">
          <Spinner label={copy.loading} />
        </div>
      ) : groups.length === 0 ? (
        <EmptyNote className="px-6 py-8">{copy.listEmpty}</EmptyNote>
      ) : (
        <div
          className={
            loading
              ? 'flex items-start gap-4 opacity-60 transition-opacity'
              : 'flex items-start gap-4 transition-opacity'
          }
        >
          {columns.map((columnGroups, columnIndex) => (
            <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
              {columnGroups.map((group) => (
                <ChannelCard
                  key={group.rows[0]!.id}
                  group={group}
                  locale={locale}
                  timezone={timezone}
                  showNsfw={showNsfw}
                  onOpen={openLightbox}
                  onTag={onTag}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Retry lives outside the aria-hidden sentinel: an interactive
          control must not hide from assistive tech. */}
      {!loading && failed && (
        <div className="py-4 text-center">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-xs text-body-muted transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-blue"
            onClick={appendNext}
          >
            {copy.loadFailed}
          </button>
        </div>
      )}

      {/* Auto-load footer: spinner while appending, end marker when done. */}
      <div ref={sentinelRef} aria-hidden="true" className="py-6 text-center">
        {loading ? (
          <Spinner label={copy.loading} />
        ) : (
          !pagination.hasNext &&
          groups.length > 0 && <span className="text-xs text-body-muted">{copy.noMore}</span>
        )}
      </div>

      {/* Shared image lightbox: zoom always, counter once the album has
          more than one slide, immersive scrim, backdrop click closes. */}
      <Lightbox
        open={lightbox.open}
        index={lightbox.index}
        slides={lightbox.images}
        close={() => setLightbox((prev) => ({ ...prev, open: false }))}
        plugins={lightboxPlugins(lightbox.images.length)}
        {...lightboxChrome}
      />
    </div>
  );
}
