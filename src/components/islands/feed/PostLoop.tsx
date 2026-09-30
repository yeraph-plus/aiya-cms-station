import { useEffect, useId, useRef, useState } from 'react';

import {
  AlignLeftIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  HeartIcon,
  KeyRoundIcon,
  LayoutGridIcon,
  MessageCircleIcon,
  PinIcon,
  StarIcon,
  XIcon,
} from 'lucide-react';

import Avatar from '@/components/islands/Avatar';
import { Card } from '@/components/ui/card';
import EmptyNote from '@/components/islands/EmptyNote';
import { Button } from '@/components/ui/button';
import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import Spinner from '@/components/islands/Spinner';
import { t, type Locale } from '@/lib/i18n';
import type { Pagination, PostSummary } from '@/lib/core/contracts';

/** Route shapes computed by the Astro page — the island never invents URLs. */
export interface FeedRoute {
  /** Page-1 path (no query). */
  index: string;
  /** Path pattern for pages ≥ 2 with a "{page}" slot. */
  pagePattern?: string;
  /** Query keys carried through pagination hrefs (e.g. ["q"]). */
  carry?: string[];
}

/** One taxonomy chip of the inline filter toolbar (Astro-built). */
export interface LoopChip {
  slug: string;
  name: string;
  /** Crawlable single-term target (the entry page) for the non-JS
      fallback; a click toggles the query URL instead (single-select). */
  href: string;
  /** Published content count of the term (WP's own per-term count, direct
      relationships only, unfiltered by the visitor's NSFW preference — a
      total-volume figure) — marked beside the name; absent renders none. */
  count?: number;
  /** Inner SVG of the term's icon meta, resolved server-side through the
      lucide lookup; null/absent renders the label only. */
  icon?: string | null;
}

interface PageMeta {
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export type LoopView = 'list' | 'grid';

/** One vocabulary group of the collapsible tag filter panel (Astro-built):
    posts ship a single flat group, resources one per tag vocabulary. */
export interface TagGroup {
  /** Stable group id (the WP taxonomy code). */
  key: string;
  /** Localized group heading; shown only when several groups exist. */
  label: string;
  items: Array<{
    slug: string;
    name: string;
    /** Server-resolved lucide inner SVG for the term's icon meta. */
    icon?: string | null;
  }>;
}

export interface PostLoopProps {
  /** Same-origin JSON feed, e.g. "/api/feed/posts/". */
  endpoint: string;
  /** Initial items + state: server-fetched, SSR-rendered. */
  items: PostSummary[];
  pagination: Pick<Pagination, 'page' | 'totalPages' | 'hasNext' | 'hasPrevious'>;
  page: number;
  /** Current filter state (q / category / author). */
  query: Record<string, string>;
  route: FeedRoute;
  perPage?: number;
  /** Taxonomy chips rendered left of the view toggle in one toolbar row;
      clicks filter the loop client-side (筛选重置页码). */
  chips?: LoopChip[];
  filterAriaLabel?: string;
  /** Standing label of the toolbar's left slot for the filter-less mode
      (author archives and other lists that carry no chips): it takes the
      place the chips row would occupy, so the row keeps a visible section
      title and the view toggle stays anchored right. Ignored when chips
      render — the two never share the slot. */
  heading?: string;
  /** Inner SVG of the heading's lucide icon, resolved server-side through
      the lucide lookup; null/absent renders the label only. */
  headingIcon?: string | null;
  /** Tag filter groups for the collapsible panel under the toolbar;
      absent (or all empty) hides the panel's toggle button. */
  tagGroups?: TagGroup[];
  /** Summary feeds (homepage sections) set false: their toggle row would
      dangle under the section header — the preference still applies from
      any full list page. */
  showViewToggle?: boolean;
  /** "More" link pinned right of the heading row (homepage sections):
      the archive target the section's window summarizes. Rendered only
      when provided; pages with a view toggle never pass it. */
  more?: { href: string; label: string };
  /** Infinite scroll: the next page appends automatically when its
      sentinel enters the viewport (main entrances only; archives keep
      explicit pagination). No history entries are pushed — back/forward
      still swaps to the SSR page the visitor navigated to. */
  autoLoad?: boolean;
  /** Initial layout; the visitor's toggle persists over it (localStorage).
      Summary feeds pin their own: pass `stickyView={false}` there. */
  defaultView?: LoopView;
  /** When false the stored layout preference is ignored and defaultView
      stands — homepage sections fix their card-grid look regardless of
      what the visitor chose on a full list page. */
  stickyView?: boolean;
  emptyText: string;
  errorText: string;
  locale: Locale;
}

/** Comma-list ↔ slug array for the multi-select term params. */
const splitSlugs = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);

/** Page-1 → index path; later pages → the page pattern; carry list rides along. */
function hrefForPage(route: FeedRoute, query: Record<string, string>, page: number): string {
  const base =
    page === 1 || !route.pagePattern
      ? route.index
      : route.pagePattern.replace('{page}', String(page));
  const params = new URLSearchParams();
  for (const key of route.carry ?? []) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Visitor-sticky layout choice; islands share one key across pages. */
const VIEW_KEY = 'aiya-loop-view';

/**
 * Full pager window: 1 and total always visible, the current page with one
 * neighbour each side, ellipsis markers wherever the sequence jumps.
 */
function pageItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set(
    [1, 2, current - 1, current, current + 1, total - 1, total].filter((n) => n >= 1 && n <= total),
  );
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const n of [...wanted].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push('ellipsis');
    out.push(n);
    prev = n;
  }
  return out;
}

function readStoredView(): LoopView | null {
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === 'list' || stored === 'grid' ? stored : null;
  } catch {
    return null;
  }
}

/** Lucide star outline path (viewBox 0 0 24 24) — inlined so the half star
    can carry its own gradient fill. */
const STAR_PATH =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.123 2.123 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

/** Five-star display of the stored 1-10 whole-point average, computed star
    by star: every full 2 points is a whole (yellow) star, a leftover 1 is a
    half star (gradient fill over a dim base), empty stars pad to five. No
    numbers on screen; the ratings count lives in the tooltip. */
function Stars({ score, label }: { score: number | null; label: string }) {
  // useId contains colons which are unsafe inside url(#…) references.
  const gradId = `star-half-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  let rest = score === null ? 0 : Math.min(10, Math.max(0, score));
  let full = 0;
  while (rest >= 2) {
    full += 1;
    rest -= 2;
  }
  const half = rest >= 1;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="relative inline-flex" role="img" aria-label={label}>
      {Array.from({ length: full }, (_, i) => (
        <StarIcon key={`f${i}`} fill="currentColor" className="size-[13px] text-yellow-400" />
      ))}
      {half && (
        <span className="relative inline-flex">
          <StarIcon className="size-[13px] text-body-muted/40" />
          <svg viewBox="0 0 24 24" className="absolute inset-0 size-[13px] text-yellow-400">
            <defs>
              <linearGradient id={gradId}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d={STAR_PATH}
              fill={`url(#${gradId})`}
              stroke={`url(#${gradId})`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      {Array.from({ length: empty }, (_, i) => (
        <StarIcon key={`e${i}`} className="size-[13px] text-body-muted/40" />
      ))}
    </span>
  );
}

/** Row 1 + 2 + 3 of the card info block; shared by both layouts. Both modes
    lock their height: list mode pins the whole card to one fixed height and
    clips, card view reserves the text rows (title two lines everywhere;
    excerpt one line on phones, two from sm up — each row holds its slot
    even when empty) and keeps the meta row to a single clipped line —
    every card in a row ends at the same baseline. */
function CardInfo({
  item,
  vertical,
  locale,
}: {
  item: PostSummary;
  vertical: boolean;
  locale: Locale;
}) {
  const copy = t(locale);
  const typeLabel =
    item.type === 'resource'
      ? copy.posts.typeResource
      : item.type === 'page'
        ? copy.posts.typePage
        : copy.posts.typePost;
  const badge = (label: string, icon: React.ReactNode, cls: string) => (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-px text-xs leading-none ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
  const badges = (
    <>
      {item.badges.includes('sticky') &&
        badge(
          copy.posts.badgeSticky,
          <PinIcon className="size-3" aria-hidden="true" />,
          'border-primary/40 bg-primary/10 text-primary',
        )}
      {item.badges.includes('password') &&
        badge(
          copy.posts.badgePassword,
          <KeyRoundIcon className="size-3" aria-hidden="true" />,
          'border-border bg-secondary text-body-muted',
        )}
      {item.badges.includes('private') &&
        badge(
          copy.posts.badgePrivate,
          <EyeOffIcon className="size-3" aria-hidden="true" />,
          'border-border bg-secondary text-body-muted',
        )}
    </>
  );
  const category = item.categories[0]?.name;
  // Counter feature matrix (0.18.0): like covers post/page, rating covers
  // resource — the last meta slot switches with the type.
  const counters =
    item.type === 'resource' ? (
      <span
        className="inline-flex shrink-0 items-center"
        title={
          item.metrics.ratingCount !== null && item.metrics.ratingCount > 0
            ? copy.posts.ratingCount(item.metrics.ratingCount)
            : undefined
        }
      >
        <Stars
          score={item.metrics.ratingScore}
          label={
            item.metrics.ratingScore !== null
              ? `${copy.posts.rating}: ${item.metrics.ratingScore}/10`
              : copy.posts.rating
          }
        />
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-center gap-1">
        <HeartIcon className="size-[13px]" aria-hidden="true" />
        {item.metrics.likes}
      </span>
    );
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {/* Row 1: badges + category + title */}
      <h2
        className={`flex min-w-0 items-center gap-x-1.5 font-display font-semibold text-foreground group-hover:text-primary ${
          vertical ? 'min-h-10 flex-wrap gap-y-1 text-sm' : 'text-base flex-nowrap overflow-hidden'
        }`}
      >
        {badges}
        {category && (
          <span className="shrink-0 text-xs font-normal text-body-muted">{category}</span>
        )}
        <span
          className={`min-w-0 ${vertical ? 'line-clamp-2' : 'truncate'} ${
            item.title === '' ? 'text-body-muted font-normal' : ''
          }`}
        >
          {item.title === '' ? copy.posts.untitled : item.title}
        </span>
      </h2>
      {/* Row 2: excerpt — one fixed-height line on phones, two lines from
          sm up (card view reserves both lines so heights stay locked) */}
      <p
        className={`text-sm text-body-muted line-clamp-1 sm:line-clamp-2 ${
          vertical ? 'h-5 sm:h-auto sm:min-h-10' : 'h-5 sm:h-auto'
        }`}
      >
        {item.excerpt}
      </p>
      {/* Row 3: type + views + comments + likes/rating (card view skips the
          author — at two-plus columns per row the name would eat the line;
          it stays first in list mode) */}
      <div
        className={`mt-auto flex flex-nowrap items-center overflow-hidden whitespace-nowrap text-xs text-body-muted ${
          vertical ? 'gap-x-2' : 'gap-x-2 sm:gap-x-3'
        }`}
      >
        {!vertical && item.author.name !== '' && (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <Avatar
              name={item.author.name}
              url={item.author.avatar?.url ?? null}
              className="size-4 text-[9px]"
            />
            {item.author.name}
          </span>
        )}
        <span className="shrink-0 rounded bg-secondary px-1.5 py-px text-[11px]">{typeLabel}</span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <EyeIcon className="size-[13px]" aria-hidden="true" />
          {item.metrics.views}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <MessageCircleIcon className="size-[13px]" aria-hidden="true" />
          {item.metrics.comments}
        </span>
        {counters}
      </div>
    </div>
  );
}

/** Compact pill of the filter panel rows (sort options and tag terms) — the
    same shadcn Button the category chips wear, so panel and toolbar read as
    one control family: default variant when active, outline otherwise. */
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="shrink-0"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Loop card: edge-to-edge first image (no margin against the card border),
 * info beside (list) or below (grid) in three rows. List mode stays a row
 * at every width — phones get a compact 120px thumb slot, sm+ the 200px
 * one — with the card pinned to a fixed height from sm up, so the layout
 * never degenerates into the stacked card look of grid mode. Card view
 * locks its height by reserving the text rows (see CardInfo).
 */
function FeedCard({
  item,
  vertical,
  locale,
}: {
  item: PostSummary;
  vertical: boolean;
  locale: Locale;
}) {
  // The backend always resolves a card image (default placeholder included)
  // — the front end adds no fallback of its own.
  const thumbUrl = item.thumbnail?.url ?? null;
  return (
    <Card
      className={`group overflow-hidden rounded-md transition-colors hover:border-body-muted ${
        vertical ? '' : 'sm:h-[132px]'
      }`}
    >
      <a
        href={item.url}
        className={
          // Card view stacks (image above info); list mode stays a row at
          // every width — on phones the thumb shrinks to a compact slot
          // instead of stacking, so list never collapses into the card look.
          vertical ? 'flex h-full flex-col' : 'flex h-full flex-row'
        }
      >
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt={item.thumbnail?.alt ?? item.title}
            width={vertical ? 320 : 200}
            height={vertical ? 180 : 132}
            className={
              vertical
                ? 'aspect-video w-full shrink-0 object-cover'
                : 'w-[120px] shrink-0 object-cover sm:w-[200px]'
            }
            loading="lazy"
            decoding="async"
          />
        )}
        <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${vertical ? 'p-3' : 'p-3 sm:p-4'}`}>
          <CardInfo item={item} vertical={vertical} locale={locale} />
        </div>
      </a>
    </Card>
  );
}

/**
 * Generic article loop island (posts / resources / author & category
 * archives share the PostSummary projection). Astro owns parameter
 * parsing, the initial request, route shapes (FeedRoute) and design
 * params; this island renders the toolbar (taxonomy chips on the left;
 * the tag-filter chevron, clear-filter and view toggles pinned right),
 * the collapsible filter panel (sort + tag groups), the list, and serves
 * subsequent states from the same-origin JSON feed. URL state: every
 * client-side update pushState's the canonical URL (cloning the
 * ClientRouter's history state), so back/forward stays owned by the
 * router's full SSR swap and hard loads / deep links keep working
 * through the path routes.
 */
export default function PostLoop({
  endpoint,
  items,
  pagination,
  page,
  query,
  route,
  perPage,
  chips,
  filterAriaLabel,
  heading,
  headingIcon,
  tagGroups,
  showViewToggle = true,
  more,
  autoLoad = false,
  defaultView = 'list',
  stickyView = true,
  emptyText,
  errorText,
  locale,
}: PostLoopProps) {
  const [state, setState] = useState({ items, pagination, page, query, route });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // SSR and the first client render agree on defaultView; the stored
  // choice (if any) lands in an effect — no hydration mismatch.
  const [view, setView] = useState<LoopView>(defaultView);
  // Optimistic chip highlight; SSR props win again after any router swap.
  const [activeCategories, setActiveCategories] = useState<string[] | null>(null);
  // Tag panel: open/closed is session-local; the selected tag set mirrors
  // the query optimistically (same pattern as activeCategories).
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTags, setActiveTags] = useState<string[] | null>(null);
  useEffect(() => {
    if (!stickyView) return;
    const stored = readStoredView();
    if (stored && stored !== defaultView) setView(stored);
  }, [defaultView, stickyView]);
  const toggleView = (next: LoopView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* storage unavailable: session-only choice */
    }
  };
  // Refs mirror the latest state for event handlers (which must not
  // re-bind per render) and guard against overlapping fetches.
  const stateRef = useRef(state);
  stateRef.current = state;
  const busyRef = useRef(false);
  // Single-flight: a state change landing mid-fetch queues itself here and
  // re-runs when the in-flight request settles — fast multi-select clicks
  // are coalesced (latest wins) instead of being dropped.
  const queuedRef = useRef<{
    next: { pagination: PageMeta; page: number; query: Record<string, string>; route: FeedRoute };
    historyUrl: string;
  } | null>(null);
  const copy = t(locale);

  /** The one feed GET both pager paths share: query dict + page → the
      parsed envelope, or null when the response is unusable. */
  const requestFeed = async (query: Record<string, string>, page: number) => {
    const target = new URL(endpoint, window.location.origin);
    for (const [key, value] of Object.entries(query)) {
      if (value) target.searchParams.set(key, value);
    }
    target.searchParams.set('page', String(page));
    if (perPage) target.searchParams.set('perPage', String(perPage));
    const response = await fetch(target, { headers: { Accept: 'application/json' } });
    return (await response.json().catch(() => null)) as {
      ok?: boolean;
      items?: PostSummary[];
      pagination?: PageMeta;
    } | null;
  };

  const fetchState = (
    next: {
      pagination: PageMeta;
      page: number;
      query: Record<string, string>;
      route: FeedRoute;
    },
    historyUrl: string,
  ) => {
    if (busyRef.current) {
      queuedRef.current = { next, historyUrl };
      return;
    }
    busyRef.current = true;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const json = await requestFeed(next.query, next.page);
        if (json?.ok && json.items && json.pagination) {
          setState({
            items: json.items,
            pagination: json.pagination,
            page: next.page,
            query: next.query,
            route: next.route,
          });
          // Clone the ClientRouter's history state so router-owned
          // back/forward keeps working for this entry.
          window.history.pushState(history.state, '', historyUrl);
        } else {
          // The optimistic chip/pill highlights derive from query state
          // that was never committed — roll them back so a failed fetch
          // doesn't leave a phantom selection behind.
          setActiveCategories(null);
          setActiveTags(null);
          setFailed(true);
        }
      } catch {
        setActiveCategories(null);
        setActiveTags(null);
        setFailed(true);
      } finally {
        busyRef.current = false;
        const queued = queuedRef.current;
        queuedRef.current = null;
        if (queued) fetchState(queued.next, queued.historyUrl);
        else setLoading(false);
      }
    })();
  };

  /**
   * Auto-load: appends the next page without touching history. A sentinel
   * div below the list drives an IntersectionObserver plus a scroll poll —
   * the observer only fires on intersection CHANGES, so a short page that
   * leaves the sentinel inside the root margin would otherwise stall; the
   * poll and the post-append re-arm keep the loop going. The loop stops
   * itself once hasNext turns false.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const failuresRef = useRef(0);
  // The re-arm timeout outlives the append that scheduled it; unmount must
  // cancel it or it fires one append (and a setState) into a dead island.
  const rearmRef = useRef<number | null>(null);
  const appendNext = () => {
    if (busyRef.current) return;
    const s = stateRef.current;
    if (!s.pagination.hasNext) return;
    busyRef.current = true;
    setLoading(true);
    void (async () => {
      let ok = false;
      try {
        const json = await requestFeed(s.query, s.page + 1);
        if (json?.ok && json.items && json.pagination) {
          ok = true;
          setState((prev) => ({
            items: [...prev.items, ...(json.items ?? [])],
            pagination: json.pagination!,
            page: prev.page + 1,
            query: prev.query,
            route: prev.route,
          }));
        }
      } catch {
        /* silent: the sentinel retriggers on the next scroll */
      } finally {
        busyRef.current = false;
        const queued = queuedRef.current;
        queuedRef.current = null;
        if (queued) {
          // A chip/tag/sort/pager click landed while this append was in
          // flight — it queued through fetchState and is the authoritative
          // next fetch (same drain as fetchState's own finally). Skip this
          // append's re-arm: its page belongs to the superseded query.
          fetchState(queued.next, queued.historyUrl);
        } else {
          setLoading(false);
          // Re-arm while the sentinel is still on screen (short pages): the
          // observer will not refire without an intersection change. A failed
          // fetch backs off exponentially (capped) so a dead endpoint is not
          // hammered at poll cadence; one success resets the ladder.
          failuresRef.current = ok ? 0 : failuresRef.current + 1;
          const delay = ok ? 200 : Math.min(200 * 2 ** failuresRef.current, 10_000);
          rearmRef.current = window.setTimeout(() => {
            const el = sentinelRef.current;
            if (el && el.getBoundingClientRect().top < window.innerHeight + 600) appendNext();
          }, delay);
        }
      }
    })();
  };

  useEffect(() => {
    if (!autoLoad) return;
    const el = sentinelRef.current;
    if (!el) return;
    const near = () => el.getBoundingClientRect().top < window.innerHeight + 600;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) appendNext();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    // Fallback poll: backgrounded tabs may never produce observer callbacks.
    const poll = window.setInterval(() => {
      if (near()) appendNext();
    }, 600);
    return () => {
      io.disconnect();
      window.clearInterval(poll);
      if (rearmRef.current !== null) window.clearTimeout(rearmRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  /** Canonical pushState URL for a query dict: every non-empty param
      (carry keys, term lists, sort) rides along, keeping the address bar
      shareable. */
  const historyUrlFor = (query: Record<string, string>): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${stateRef.current.route.index}?${qs}` : stateRef.current.route.index;
  };

  const applySort = (next: 'newest' | 'oldest') => {
    const s = stateRef.current;
    const nextQuery: Record<string, string> = { ...s.query, sort: next };
    fetchState(
      {
        pagination: s.pagination,
        page: 1,
        query: nextQuery,
        route: s.route,
      },
      historyUrlFor(nextQuery),
    );
  };

  /** Category chips are single-select (0.96.0): a click makes the term the
      only chosen category — clicking the active one (or "all") clears the
      filter. Multi-select stays the tag panel's job. The "all" chip
      normalizes to an empty selection so its own highlight rule
      (chipActive on an empty set) stays truthful. */
  const applyChip = (chip: LoopChip) => {
    const s = stateRef.current;
    const current = activeCategories ?? splitSlugs(s.query.category);
    const next =
      chip.slug === '' || (current.length === 1 && current[0] === chip.slug) ? [] : [chip.slug];
    setActiveCategories(next);
    const nextQuery: Record<string, string> = { ...s.query, category: next.join(',') };
    fetchState(
      {
        pagination: s.pagination,
        page: 1,
        query: nextQuery,
        route: s.route,
      },
      historyUrlFor(nextQuery),
    );
  };

  /** Tag filter: toggling slugs in the comma list (multi-select). The
      panel stays open so several tags can be combined in a row. */
  const applyTag = (slug: string) => {
    const s = stateRef.current;
    const current = activeTags ?? splitSlugs(s.query.tag);
    const next = current.includes(slug)
      ? current.filter((value) => value !== slug)
      : [...current, slug];
    setActiveTags(next);
    const nextQuery: Record<string, string> = { ...s.query, tag: next.join(',') };
    fetchState(
      {
        pagination: s.pagination,
        page: 1,
        query: nextQuery,
        route: s.route,
      },
      historyUrlFor(nextQuery),
    );
  };

  /** Clears every selected tag (toolbar button next to the chevron). */
  const clearTagFilter = () => {
    setActiveTags([]);
    const s = stateRef.current;
    const nextQuery: Record<string, string> = { ...s.query, tag: '' };
    fetchState(
      {
        pagination: s.pagination,
        page: 1,
        query: nextQuery,
        route: s.route,
      },
      historyUrlFor(nextQuery),
    );
  };

  const gotoPage = (next: number) => {
    fetchState(
      {
        pagination: stateRef.current.pagination,
        page: next,
        query: stateRef.current.query,
        route: stateRef.current.route,
      },
      hrefForPage(stateRef.current.route, stateRef.current.query, next),
    );
  };

  const vertical = view === 'grid';
  const groups = (tagGroups ?? []).filter((group) => group.items.length > 0);
  const hasTags = groups.length > 0;
  const chipItems = chips ?? [];
  const hasChips = chipItems.length > 0;
  // The heading takes the left slot only in the filter-less mode: chips win
  // it whenever they render, so a page never shows both.
  const hasHeading = !hasChips && Boolean(heading);
  const categorySet = activeCategories ?? splitSlugs(state.query.category);
  const tagSet = activeTags ?? splitSlugs(state.query.tag);
  const chipActive = (slug: string) =>
    slug === '' ? categorySet.length === 0 : categorySet.includes(slug);
  // Literal classes only — Tailwind's scanner cannot see interpolated names.
  // Card view never drops below two columns: on phones the single-column
  // grid degenerated into a wall of aspect-video images with no scan grid.
  const listClass = vertical
    ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    : 'flex flex-col gap-3';
  return (
    <div aria-busy={loading}>
      {/* Toolbar: the left slot holds the taxonomy chips (filter mode) or,
          for filter-less lists, the standing heading the page passed; it
          scrolls horizontally when it overflows (no visible scrollbar). The
          separator, filter chevron, clear-filter button and view toggles sit
          pinned right. */}
      <div className="mb-3 flex items-center gap-3">
        {hasChips && (
          <nav
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={filterAriaLabel}
          >
            {chipItems.map((chip) => {
              const active = chipActive(chip.slug);
              return (
                <Button
                  key={chip.slug || 'all'}
                  asChild
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0"
                >
                  <a
                    href={chip.href}
                    aria-current={active ? 'page' : undefined}
                    className="inline-flex items-center gap-1.5"
                    onClick={(event) => {
                      event.preventDefault();
                      applyChip(chip);
                    }}
                  >
                    {chip.icon && (
                      <svg
                        viewBox="0 0 24 24"
                        width={14}
                        height={14}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: chip.icon }}
                      />
                    )}
                    {chip.name}
                    {chip.count !== undefined && (
                      <span className="text-[11px] font-normal opacity-70">{chip.count}</span>
                    )}
                  </a>
                </Button>
              );
            })}
          </nav>
        )}
        {hasHeading && (
          <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-lg font-semibold text-foreground">
            {headingIcon && (
              <svg
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0"
                dangerouslySetInnerHTML={{ __html: headingIcon }}
              />
            )}
            <span className="truncate">{heading}</span>
          </h2>
        )}
        {more && (
          <a
            href={more.href}
            className="ml-auto shrink-0 text-sm text-body-muted transition-colors hover:text-primary"
          >
            {more.label} →
          </a>
        )}
        {showViewToggle && (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* Leading separator only when the left slot is occupied —
                archives without chips or heading would otherwise show a
                dangling line. */}
            {(hasChips || hasHeading) && (
              <div aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
            )}
            {hasTags && tagSet.length > 0 && (
              <Button variant="outline" size="sm" className="shrink-0" onClick={clearTagFilter}>
                <XIcon aria-hidden="true" />
                {copy.posts.clearFilter}
              </Button>
            )}
            {hasTags && (
              <Button
                variant={panelOpen || tagSet.length > 0 ? 'default' : 'outline'}
                size="icon"
                className="size-8"
                aria-expanded={panelOpen}
                aria-label={copy.posts.filter}
                title={copy.posts.filter}
                onClick={() => setPanelOpen((open) => !open)}
              >
                <ChevronDownIcon
                  aria-hidden="true"
                  className={`transition-transform ${panelOpen ? 'rotate-180' : ''}`}
                />
                <span className="sr-only">{copy.posts.filter}</span>
              </Button>
            )}
            {/* Second separator: keeps the filter controls and the view
                toggles visually apart (only when the chevron exists). */}
            {hasTags && <div aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />}
            <div
              className="flex shrink-0 gap-1.5"
              role="group"
              aria-label={`${copy.posts.viewList} / ${copy.posts.viewGrid}`}
            >
              <Button
                variant={!vertical ? 'default' : 'outline'}
                size="icon"
                className="size-8"
                aria-pressed={!vertical}
                title={copy.posts.viewList}
                onClick={() => toggleView('list')}
              >
                <AlignLeftIcon aria-hidden="true" />
                <span className="sr-only">{copy.posts.viewList}</span>
              </Button>
              <Button
                variant={vertical ? 'default' : 'outline'}
                size="icon"
                className="size-8"
                aria-pressed={vertical}
                title={copy.posts.viewGrid}
                onClick={() => toggleView('grid')}
              >
                <LayoutGridIcon aria-hidden="true" />
                <span className="sr-only">{copy.posts.viewGrid}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
      {panelOpen && hasTags && (
        <div className="mb-3 border-y border-border py-2.5">
          <div className="space-y-1.5">
            {/* Sort row: moved out of the chips nav into the panel. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-sm text-body-muted">{copy.posts.sort}</span>
              <FilterPill
                active={(state.query.sort ?? 'newest') !== 'oldest'}
                onClick={() => applySort('newest')}
              >
                {copy.posts.sortNewest}
              </FilterPill>
              <FilterPill
                active={(state.query.sort ?? 'newest') === 'oldest'}
                onClick={() => applySort('oldest')}
              >
                {copy.posts.sortOldest}
              </FilterPill>
            </div>
            {groups.map((group) => (
              <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 text-sm text-body-muted">{group.label}</span>
                {group.items.map((tag) => (
                  <FilterPill
                    key={tag.slug}
                    active={tagSet.includes(tag.slug)}
                    onClick={() => applyTag(tag.slug)}
                  >
                    {tag.icon && (
                      <svg
                        viewBox="0 0 24 24"
                        width={13}
                        height={13}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: tag.icon }}
                      />
                    )}
                    {tag.name}
                  </FilterPill>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {state.items.length > 0 ? (
        <div
          className={
            listClass + (loading ? ' opacity-60 transition-opacity' : ' transition-opacity')
          }
        >
          {state.items.map((item) => (
            <FeedCard key={item.id} item={item} vertical={vertical} locale={locale} />
          ))}
        </div>
      ) : autoLoad ? null : (
        <EmptyNote className="px-6 py-8">{emptyText}</EmptyNote>
      )}
      {autoLoad && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          className="py-6 text-center text-xs text-body-muted"
        >
          {loading ? (
            <Spinner label={copy.posts.loading} />
          ) : state.pagination.hasNext ? null : (
            copy.posts.noMore
          )}
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-error">
          {errorText}
        </p>
      )}
      {!autoLoad && state.pagination.totalPages > 1 && (
        <PaginationRoot className="mt-8 text-xs" aria-label={t(locale).common.pagination}>
          <PaginationContent>
            <PaginationItem>
              {state.pagination.hasPrevious ? (
                <PaginationLink
                  href={hrefForPage(state.route, state.query, state.page - 1)}
                  rel="prev"
                  size="default"
                  className="h-8 px-2.5 text-xs"
                  onClick={(event) => {
                    event.preventDefault();
                    gotoPage(state.page - 1);
                  }}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                  <span className="hidden sm:inline">{copy.common.previousPage}</span>
                </PaginationLink>
              ) : (
                <span className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs opacity-40">
                  <ChevronLeftIcon aria-hidden="true" />
                  <span className="hidden sm:inline">{copy.common.previousPage}</span>
                </span>
              )}
            </PaginationItem>
            {pageItems(state.page, state.pagination.totalPages).map((item, index) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`gap-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href={hrefForPage(state.route, state.query, item)}
                    isActive={item === state.page}
                    className="size-8 text-xs"
                    onClick={(event) => {
                      event.preventDefault();
                      gotoPage(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              {state.pagination.hasNext ? (
                <PaginationLink
                  href={hrefForPage(state.route, state.query, state.page + 1)}
                  rel="next"
                  size="default"
                  className="h-8 px-2.5 text-xs"
                  onClick={(event) => {
                    event.preventDefault();
                    gotoPage(state.page + 1);
                  }}
                >
                  <span className="hidden sm:inline">{copy.common.nextPage}</span>
                  <ChevronRightIcon aria-hidden="true" />
                </PaginationLink>
              ) : (
                <span className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs opacity-40">
                  <span className="hidden sm:inline">{copy.common.nextPage}</span>
                  <ChevronRightIcon aria-hidden="true" />
                </span>
              )}
            </PaginationItem>
          </PaginationContent>
        </PaginationRoot>
      )}
    </div>
  );
}
