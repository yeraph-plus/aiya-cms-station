import { useEffect, useId, useRef, useState } from 'react';
import { postRoute } from '@/lib/content';

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
import { nextCategorySelection, splitCategoryChips } from '@/lib/filters';
import { t, type Dictionary, type Locale } from '@/lib/i18n';
import type { Pagination, PostSummary } from '@/lib/core/contracts';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';

/** Route shapes computed by the Astro page — the island never invents URLs. */
export interface FeedRoute {
  /** Page-1 path (no query). */
  index: string;
  /** Path pattern for pages ≥ 2 with a "{page}" slot. */
  pagePattern?: string;
  /** Query keys carried through pagination hrefs (e.g. ["q"]). */
  carry?: string[];
}

/** One taxonomy term as the toolbar chips and the panel rows render it: the
    label plus the term icon meta the server resolved through the lucide
    lookup. Both surfaces share the shape, so a term moves between them (the
    category table's split) without being re-projected. */
export interface TermItem {
  slug: string;
  name: string;
  /** Inner SVG of the term's icon meta; null/absent renders the label only. */
  icon?: string | null;
}

/** One category chip of the inline filter toolbar (Astro-built). */
export interface LoopChip extends TermItem {
  /** Crawlable single-term target (the entry page) for the non-JS
      fallback; a click toggles the query URL instead (single-select). */
  href: string;
  /** Published content count of the term (WP's own per-term count, direct
      relationships only, unfiltered by the visitor's NSFW preference — a
      total-volume figure) — marked beside the name; absent renders none. */
  count?: number;
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
      clicks filter the loop client-side (筛选重置页码). Only the "all" chip
      plus the busiest categories reach the row (lib/filters splits the table
      at CATEGORY_CHIP_CAP); the terms left over render in the panel's
      category row — both sides write the same single-select `category`
      param, so the table stays one filter. */
  chips?: LoopChip[];
  /** Label of the category taxonomy the chips list: the toolbar row's
      aria-label and the heading of the panel's category row. */
  categoryLabel?: string;
  /** Standing label of the toolbar's left slot for the filter-less mode
      (author archives and other lists that carry no chips): it takes the
      place the chips row would occupy, so the row keeps a visible section
      title and the view toggle stays anchored right. Ignored when chips
      render — the two never share the slot. */
  heading?: string;
  /** Inner SVG of the heading's lucide icon, resolved server-side through
      the lucide lookup; null/absent renders the label only. */
  headingIcon?: string | null;
  /** Tag filter groups for the collapsible panel under the toolbar (toggled
      multi-select); absent (or all empty) hides their rows. The panel's
      category row comes from `chips`, not from here. */
  tagGroups?: TagGroup[];
  /** Summary feeds (homepage sections) set false: their toggle row would
      dangle under the section header — the preference still applies from
      any full list page. */
  showViewToggle?: boolean;
  /** "More" link pinned right of the heading row (homepage sections):
      the archive target the section's window summarizes. Rendered only
      when provided; pages with a view toggle never pass it. */
  more?: { href: string; label: string };
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

/** The non-empty entries of a query dict as URL params, insertion order
    kept. `keys` narrows it to a route's carry list, so a paginated link
    never drops a filter the address bar carries. */
function queryParams(query: Record<string, string>, keys?: string[]): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of keys ?? Object.keys(query)) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Page-1 → index path; later pages → the page pattern; carry list rides along. */
function hrefForPage(route: FeedRoute, query: Record<string, string>, page: number): string {
  const base =
    page === 1 || !route.pagePattern
      ? route.index
      : route.pagePattern.replace('{page}', String(page));
  const qs = queryParams(query, route.carry ?? []).toString();
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
      {/* Row 1: badges + title. Card view wraps the title at a size one step
          above the excerpt; list mode stays a single truncated line led by
          every category name. */}
      <h2
        className={`flex min-w-0 items-center gap-x-1.5 font-display font-medium text-foreground group-hover:text-primary ${
          vertical
            ? 'min-h-12 flex-wrap gap-y-1 text-base'
            : 'text-base flex-nowrap overflow-hidden'
        }`}
      >
        {badges}
        {!vertical &&
          item.categories.map((c) => (
            <span key={c.slug} className="shrink-0 text-xs font-normal text-body-muted">
              {c.name}
            </span>
          ))}
        <span
          className={`min-w-0 ${vertical ? 'line-clamp-2' : 'truncate'} ${
            item.title === '' ? 'text-body-muted font-normal' : ''
          }`}
        >
          {item.title === '' ? copy.posts.untitled : item.title}
        </span>
      </h2>
      {/* Row 1.5 (card view only): every category, on its own line. */}
      {vertical && item.categories.length > 0 && (
        <p className="flex flex-wrap gap-x-1.5 text-xs font-normal text-body-muted">
          {item.categories.map((c) => (
            <span key={c.slug}>{c.name}</span>
          ))}
        </p>
      )}
      {/* Row 2: excerpt — a fixed two-line block at every width so list rows
          and card heights stay locked; the bottom margin keeps the meta row
          off the text. */}
      <p className="mb-2 text-sm text-body-muted line-clamp-2 h-10">{item.excerpt}</p>
      {/* Row 3: views + comments + likes/rating, pinned to the card bottom
          (card view skips the author — at two-plus columns per row the name
          would eat the line; it stays first in list mode). */}
      <div
        className={`mt-auto flex flex-nowrap items-center overflow-hidden whitespace-nowrap text-xs tabular-nums text-body-muted ${
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

/** Term icon of a chip or panel pill: the server resolved the term's icon
    meta into an inner SVG (`iconInner`) — null/absent renders the label
    alone. One component so the toolbar and the panel cannot drift. */
function TermIcon({ icon, size }: { icon?: string | null; size: number }) {
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon }}
    />
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

/** One labelled row of filter pills: a vocabulary's heading plus its terms,
    the active ones highlighted. The panel's category row and every tag
    vocabulary wear the same row, so the two can never disagree on spacing or
    on what a term looks like. `label` is optional — the toolbar's own
    category row heading is passed only when the page has one. */
function FilterRow({
  label,
  items,
  active,
  onToggle,
}: {
  label?: string;
  items: TermItem[];
  active: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="shrink-0 text-sm text-body-muted">{label}</span>}
      {items.map((term) => (
        <FilterPill
          key={term.slug}
          active={active.includes(term.slug)}
          onClick={() => onToggle(term.slug)}
        >
          <TermIcon icon={term.icon} size={13} />
          {term.name}
        </FilterPill>
      ))}
    </div>
  );
}

/**
 * Loop card: edge-to-edge first image (no margin against the card border),
 * info beside (list) or below (grid) in three rows. Backend covers are
 * always 16:9 (640×360 pipeline), so both modes size the image as an
 * uncropped aspect-video box: grid stacks it full-width; list mode walks
 * four per-breakpoint thumb sizes (120 / 160 / 200 / 240 / 288px) so the
 * image never overwhelms small screens, and the text column stretches
 * top-aligned with the meta row pinned to the card bottom. Card view locks
 * its height by reserving the text rows (see CardInfo). `enter` rides only
 * on client-appended items (infinite scroll) — SSR HTML never carries it,
 * so first paint never plays an entrance.
 */
function FeedCard({
  item,
  vertical,
  locale,
  enter = false,
}: {
  item: PostSummary;
  vertical: boolean;
  locale: Locale;
  enter?: boolean;
}) {
  // The backend always resolves a card image (default placeholder included)
  // — the front end adds no fallback of its own.
  const thumbUrl = item.thumbnail?.url ?? null;
  return (
    <Card
      className={`group overflow-hidden rounded-lg transition-shadow duration-base hover:shadow-sm ${
        enter ? 'animate-in fade-in slide-in-from-bottom-2 duration-slow' : ''
      }`}
    >
      <a
        href={postRoute(item.type, item.slug)}
        className={
          // Card view stacks (image above info); list mode stays a row at
          // every width — on phones the thumb shrinks to a compact slot
          // instead of stacking, so list never collapses into the card look.
          // The 16:9 thumb is one of four per-breakpoint sizes; the text
          // column stretches (top-aligned) and pins its meta row to the
          // card bottom.
          vertical ? 'flex h-full flex-col' : 'flex h-full flex-row'
        }
      >
        {thumbUrl &&
          (vertical ? (
            // 16:10 (the magazine card ratio) inside a clipping box, so the
            // hover scale never bleeds into the text column.
            <div className="aspect-[16/10] w-full shrink-0 overflow-hidden">
              <img
                src={thumbUrl}
                alt={item.thumbnail?.alt ?? item.title}
                width={320}
                height={200}
                className="size-full object-cover transition-transform duration-slow group-hover:scale-[1.04]"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <img
              src={thumbUrl}
              alt={item.thumbnail?.alt ?? item.title}
              width={288}
              height={162}
              className="aspect-video w-[120px] shrink-0 self-center object-cover sm:w-[160px] md:w-[200px] lg:w-[240px] 2xl:w-[288px]"
              loading="lazy"
              decoding="async"
            />
          ))}
        <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${vertical ? 'p-4' : 'p-4 sm:p-5'}`}>
          <CardInfo item={item} vertical={vertical} locale={locale} />
        </div>
      </a>
    </Card>
  );
}

/**
 * The pager buttons — the navigation mode of every list whose toolbar has no
 * filter bar: term archives, search, author profiles, and any page past the
 * first. Hrefs stay real paths, so a middle-click (or a click before the
 * island hydrates) still lands on the SSR page; a plain click swaps the list
 * in place. Renders nothing for a single-page list.
 */
function LoopPager({
  pagination,
  page,
  route,
  query,
  copy,
  onGoto,
}: {
  pagination: PageMeta;
  page: number;
  route: FeedRoute;
  query: Record<string, string>;
  copy: Dictionary;
  onGoto: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  /** One end cap: a link while the step exists, a dimmed stand-in otherwise
      (the row keeps its width). The icon leads on the previous side and
      trails on the next. */
  const cap = (
    rel: 'prev' | 'next',
    enabled: boolean,
    target: number,
    label: string,
    icon: React.ReactNode,
  ) => {
    const content = (
      <>
        {rel === 'prev' && icon}
        <span className="hidden sm:inline">{label}</span>
        {rel === 'next' && icon}
      </>
    );
    return enabled ? (
      <PaginationLink
        href={hrefForPage(route, query, target)}
        rel={rel}
        size="default"
        className="h-8 px-2.5 text-xs"
        onClick={(event) => {
          event.preventDefault();
          onGoto(target);
        }}
      >
        {content}
      </PaginationLink>
    ) : (
      <span className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs opacity-40">
        {content}
      </span>
    );
  };
  return (
    <PaginationRoot className="mt-8 text-xs" aria-label={copy.common.pagination}>
      <PaginationContent>
        <PaginationItem>
          {cap(
            'prev',
            pagination.hasPrevious,
            page - 1,
            copy.common.previousPage,
            <ChevronLeftIcon aria-hidden="true" />,
          )}
        </PaginationItem>
        {pageItems(page, pagination.totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href={hrefForPage(route, query, item)}
                isActive={item === page}
                className="size-8 text-xs"
                onClick={(event) => {
                  event.preventDefault();
                  onGoto(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          {cap(
            'next',
            pagination.hasNext,
            page + 1,
            copy.common.nextPage,
            <ChevronRightIcon aria-hidden="true" />,
          )}
        </PaginationItem>
      </PaginationContent>
    </PaginationRoot>
  );
}

/**
 * Generic article loop island (posts / resources / author & category
 * archives share the PostSummary projection). Astro owns parameter
 * parsing, the initial request, route shapes (FeedRoute) and design
 * params; this island renders the toolbar (taxonomy chips on the left;
 * the filter chevron, clear-filter and view toggles pinned right), the
 * collapsible filter panel (sort + the categories the toolbar window left
 * out + tag groups), the list, and serves subsequent states from the
 * same-origin JSON feed. Two navigation modes ride the toolbar's left
 * slot: the filter bar (chips) appends the next page as the visitor
 * scrolls, anything else (the standing heading, a bare archive) shows the
 * pager buttons — see the `autoLoad` derivation below. URL state: every client-side
 * update pushState's the canonical URL (cloning the ClientRouter's
 * history state), so back/forward stays owned by the router's full SSR
 * swap and hard loads / deep links keep working through the path routes.
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
  categoryLabel,
  heading,
  headingIcon,
  tagGroups,
  showViewToggle = true,
  more,
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
  // Incremented on every explicit view toggle: keys the list container so
  // the layout switch replays a one-shot fade (never on initial mount —
  // epoch 0 renders without the animation class).
  const [viewEpoch, setViewEpoch] = useState(0);
  // Length of the non-appended prefix of state.items: indexes from here on
  // entered through infinite scroll and ride the entrance animation.
  // Replacements (filter / sort / pager) reset it to the new list length.
  const [enterBaseline, setEnterBaseline] = useState(items.length);
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
    setViewEpoch((epoch) => epoch + 1);
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
  const vertical = view === 'grid';
  const groups = (tagGroups ?? []).filter((group) => group.items.length > 0);
  const hasTags = groups.length > 0;
  // The category table is split by volume: the busiest terms ride the
  // toolbar row, the tail waits in the panel's category row (same
  // single-select param on either side).
  const { toolbar: toolbarChips, panel: panelCategoryChips } = splitCategoryChips(chips ?? []);
  const hasChips = toolbarChips.length > 0;
  const hasCategoryRow = panelCategoryChips.length > 0;
  // Either row justifies the chevron: the tag groups and the category tail
  // both live behind it (a chips-only list with a short table has neither).
  const hasPanel = hasTags || hasCategoryRow;
  // The heading takes the left slot only in the filter-less mode: chips win
  // it whenever they render, so a page never shows both.
  const hasHeading = !hasChips && Boolean(heading);
  // Navigation mode follows that left slot, never the page: while the filter
  // bar owns the row the visitor is reading a stream, so the next page
  // appends itself; without it — the standing heading, or a bare archive —
  // the loop hands over to the pager buttons. One derivation, so no route
  // can hand this island a mode its own toolbar contradicts.
  const autoLoad = hasChips;
  const categorySet = activeCategories ?? splitSlugs(state.query.category);
  const tagSet = activeTags ?? splitSlugs(state.query.tag);
  // A term chosen from the panel's category row has no chip in the toolbar
  // (it sits below the cut), so the chevron itself has to carry the state —
  // otherwise a filtered list would show no selected control at all.
  const panelCategoryActive = panelCategoryChips.some((term) => categorySet.includes(term.slug));
  const chipActive = (slug: string) =>
    slug === '' ? categorySet.length === 0 : categorySet.includes(slug);
  // Literal classes only — Tailwind's scanner cannot see interpolated names.
  // Card view never drops below two columns (through sm): on phones the
  // single-column grid degenerated into a wall of aspect-video images with
  // no scan grid.
  const listClass = vertical
    ? 'grid grid-cols-2 gap-5 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5'
    : 'flex flex-col gap-4';

  /** The one feed GET both pager paths share: query dict + page → the
      parsed envelope, or null when the response is unusable. */
  const requestFeed = async (query: Record<string, string>, page: number) => {
    const target = new URL(endpoint, window.location.origin);
    for (const [key, value] of queryParams(query)) target.searchParams.set(key, value);
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
          // A replacement list carries no appended tail — every item is
          // "already there" and must not play the entrance animation.
          setEnterBaseline(json.items.length);
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
   * Auto-load: appends the next page without touching history. Sentinel
   * observation and re-arm live in the shared hook; this island owns the
   * fetch itself (single-flight + queue). The loop stops itself once hasNext
   * turns false.
   */
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
          const { items, pagination } = json;
          setState((prev) => ({
            items: [...prev.items, ...items],
            pagination,
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
          rearm(ok);
        }
      }
    })();
  };

  const { sentinelRef, rearm } = useInfiniteScroll({ enabled: autoLoad, start: appendNext });

  /** Canonical pushState URL for a query dict: every non-empty param
      (carry keys, term lists, sort) rides along, keeping the address bar
      shareable. */
  const historyUrlFor = (query: Record<string, string>): string => {
    const qs = queryParams(query).toString();
    const { index } = stateRef.current.route;
    return qs ? `${index}?${qs}` : index;
  };

  /** Commit a page-1 change of the filter state (sort / category / tag):
      optimistic highlight, single-flight fetch, canonical URL. The pager's
      gotoPage is the only caller that keeps its page number. */
  const applyQuery = (nextQuery: Record<string, string>) => {
    const s = stateRef.current;
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

  const applySort = (next: 'newest' | 'oldest') =>
    applyQuery({ ...stateRef.current.query, sort: next });

  /** Category selection is single-select on both rows (0.96.0): a click makes
      the term the only chosen category — clicking the active one (or "all")
      clears the filter, and the toolbar chips and the panel's category row
      share the rule through lib/filters. Multi-select stays the tag panel's
      job. The "all" chip normalizes to an empty selection so its own
      highlight rule (chipActive on an empty set) stays truthful. */
  const applyCategory = (slug: string) => {
    const current = activeCategories ?? splitSlugs(stateRef.current.query.category);
    const next = nextCategorySelection(current, slug);
    setActiveCategories(next);
    applyQuery({ ...stateRef.current.query, category: next.join(',') });
  };

  /** Tag filter: toggling slugs in the comma list (multi-select). The
      panel stays open so several tags can be combined in a row. */
  const applyTag = (slug: string) => {
    const current = activeTags ?? splitSlugs(stateRef.current.query.tag);
    const next = current.includes(slug)
      ? current.filter((value) => value !== slug)
      : [...current, slug];
    setActiveTags(next);
    applyQuery({ ...stateRef.current.query, tag: next.join(',') });
  };

  /** Clears every selected tag (toolbar button next to the chevron). */
  const clearTagFilter = () => {
    setActiveTags([]);
    applyQuery({ ...stateRef.current.query, tag: '' });
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

  return (
    // `@container`: the column count follows the *content* width, not the
    // viewport. With the 190px shell sidebar taking a bite out of every
    // desktop width, viewport breakpoints over-packed the grid (1280px viewport
    // → 4 columns in a 988px column). Container queries keep the card measure
    // stable at ~210–270px across 992/1280/1440/1920 and when the sidebar
    // collapses.
    <div aria-busy={loading} className="@container">
      {/* Toolbar: the left slot holds the taxonomy chips (filter mode) or,
          for filter-less lists, the standing heading the page passed; it
          scrolls horizontally when it overflows (no visible scrollbar). The
          separator, filter chevron, clear-filter button and view toggles sit
          pinned right. */}
      <div className="mb-3 flex items-center gap-3">
        {hasChips && (
          <nav
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label={categoryLabel}
          >
            {toolbarChips.map((chip) => {
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
                      applyCategory(chip.slug);
                    }}
                  >
                    <TermIcon icon={chip.icon} size={14} />
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
          <h2 className="relative flex min-w-0 flex-1 items-center gap-2 pb-3 font-display text-lg font-medium text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-[50px] after:bg-foreground after:content-['']">
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
            className="ml-auto shrink-0 text-sm font-medium text-body-muted transition-colors hover:text-primary"
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
            {hasPanel && (
              <Button
                variant={
                  panelOpen || tagSet.length > 0 || panelCategoryActive ? 'default' : 'outline'
                }
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
            {hasPanel && <div aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />}
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
      {panelOpen && hasPanel && (
        <div className="mb-3 animate-in fade-in slide-in-from-top-2 border-y border-border py-2.5 duration-base">
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
            {/* Category row: the terms the toolbar window left out, carrying
                the toolbar's own single-select rule — one choice across both
                rows, so the split never splits the filter. */}
            {hasCategoryRow && (
              <FilterRow
                label={categoryLabel}
                items={panelCategoryChips}
                active={categorySet}
                onToggle={applyCategory}
              />
            )}
            {groups.map((group) => (
              <FilterRow
                key={group.key}
                label={group.label}
                items={group.items}
                active={tagSet}
                onToggle={applyTag}
              />
            ))}
          </div>
        </div>
      )}
      {state.items.length > 0 ? (
        <div
          key={viewEpoch}
          className={
            listClass +
            (viewEpoch > 0 ? ' animate-in fade-in duration-base' : '') +
            (loading ? ' opacity-60 transition-opacity' : ' transition-opacity')
          }
        >
          {state.items.map((item, index) => (
            <FeedCard
              key={item.id}
              item={item}
              vertical={vertical}
              locale={locale}
              enter={index >= enterBaseline}
            />
          ))}
        </div>
      ) : (
        <EmptyNote className="px-6 py-8">{emptyText}</EmptyNote>
      )}
      {/* Append sentinel: stays mounted in the chips mode even while the list
          is empty — the observer is armed once, so unmounting it would kill
          auto-load for the rest of the session. Its text belongs to a list
          that actually has items (an empty result wears the empty note
          alone). */}
      {autoLoad && (
        <div
          ref={sentinelRef}
          aria-hidden="true"
          className="py-6 text-center text-xs text-body-muted"
        >
          {loading ? (
            <Spinner label={copy.posts.loading} />
          ) : state.items.length > 0 && !state.pagination.hasNext ? (
            copy.posts.noMore
          ) : null}
        </div>
      )}
      {failed && (
        <p role="alert" className="mt-3 text-sm text-error">
          {errorText}
        </p>
      )}
      {!autoLoad && (
        <LoopPager
          pagination={state.pagination}
          page={state.page}
          route={state.route}
          query={state.query}
          copy={copy}
          onGoto={gotoPage}
        />
      )}
    </div>
  );
}
