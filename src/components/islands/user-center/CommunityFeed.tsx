import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ChevronDownIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PencilIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
} from 'lucide-react';

import Lightbox from 'yet-another-react-lightbox';
import { Counter, Zoom } from 'yet-another-react-lightbox/plugins';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyNote from '@/components/islands/EmptyNote';
import Spinner from '@/components/islands/Spinner';
import Avatar from '@/components/islands/Avatar';
import ConfirmPopover from '@/components/islands/ConfirmPopover';
import RichEditor, {
  AttachmentStrip,
  PostEditorBlock,
} from '@/components/islands/user-center/RichEditor';
import { toastApiError } from '@/lib/feedback';
import { t, type Locale } from '@/lib/i18n';
import type { FeedThread, FeedReply } from '@/lib/community';
import type { Pagination } from '@/lib/core/contracts';
import { htmlHasContent } from '@/lib/content';
import { displayDate } from '@/lib/format';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { uploadImage } from '@/lib/upload';

type PageMeta = Pick<Pagination, 'page' | 'totalPages' | 'hasNext' | 'hasPrevious'>;

export interface FeedBoard {
  id: number;
  slug: string;
  name: string;
  threads: number;
}

interface Props {
  initialThreads: FeedThread[];
  initialPagination: PageMeta;
  boards: FeedBoard[];
  initialBoard: string;
  canPost: boolean;
  /** Signed-in visitor (name + avatar) for the reply composer identity. */
  user: { name: string; avatarUrl: string | null } | null;
  locale: Locale;
  /** Site calendar timezone (from /site); displayDate renders dates in it. */
  timezone?: string;
}

type Sort = 'last_activity' | 'newest';

interface ReplyCache {
  items: FeedReply[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  loaded: boolean;
}

/** Column template per image count: 1 large, 2/3 in a row, 4 as 2×2,
 *  5 as 3+2 (bottom row spans 3 each), 6 as 2×3, 7/8 in four columns,
 *  9 as the classic 3×3 wall. */
const imageGridClass = (count: number): string => {
  switch (Math.min(count, 9)) {
    case 1:
      return 'grid-cols-1';
    case 2:
      return 'grid-cols-2';
    case 4:
      return 'grid-cols-2';
    case 5:
      return 'grid-cols-6';
    case 7:
    case 8:
      return 'grid-cols-4';
    default:
      return 'grid-cols-3';
  }
};

/** Thread/reply image area: ~70% of the column on desktop, full width on
 *  mobile, with a count-aware grid layout. Clicking an image opens the
 *  lightbox at that index (caller supplies the shared gallery). */
function ImageGrid({
  images,
  onOpen,
}: {
  images: FeedThread['images'];
  onOpen?: (index: number) => void;
}) {
  if (images.length === 0) return null;
  const count = Math.min(images.length, 9);
  const five = count === 5;
  return (
    <div className="w-full sm:w-[68%]">
      <div
        className={`grid gap-0.5 overflow-hidden rounded-lg border border-border ${imageGridClass(count)}`}
      >
        {images.slice(0, 9).map((img, index) => {
          const layout =
            count === 1
              ? 'aspect-video w-full object-cover'
              : five
                ? `aspect-square w-full object-cover ${index < 3 ? 'col-span-2' : 'col-span-3'}`
                : 'aspect-square w-full object-cover';
          return (
            <img
              key={img.url + index}
              src={img.url}
              alt={img.alt || ''}
              loading="lazy"
              decoding="async"
              onClick={onOpen ? () => onOpen(index) : undefined}
              className={`${onOpen ? 'cursor-zoom-in ' : ''}${layout}`}
            />
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';

class FeedErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { message: string | null }
> {
  state = { message: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
  componentDidCatch(error: unknown) {
    // The stack rides along in dev only — production visitors should not
    // see internal paths, and the browser console keeps it regardless.
    if (!import.meta.env.DEV) return;
    this.setState((prev) => ({
      message:
        (prev.message ?? '') +
        '\n--- stack ---\n' +
        String((error as Error)?.stack ?? '').slice(0, 800),
    }));
  }
  render() {
    if (this.state.message) {
      return (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            color: 'crimson',
            padding: 16,
            border: '1px solid crimson',
          }}
        >
          {this.state.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

/**
 * The community feed island: composer (Tiptap) + full-inline thread cards +
 * collapsible reply sections. Astro only forwards data — board switching,
 * publishing, replies, and moderation all run client-side through the
 * /api/discussions proxies.
 */
function CommunityFeedInner({
  initialThreads,
  initialPagination,
  boards,
  initialBoard,
  canPost,
  user,
  locale,
  timezone,
}: Props) {
  const copy = t(locale).community;
  const [threads, setThreads] = useState(initialThreads);
  const [pagination, setPagination] = useState(initialPagination);
  /** Composer target board — defaults to the first board (never empty). */
  const [composerBoard, setComposerBoard] = useState(boards[0]?.slug ?? initialBoard);
  /** Feed filter — '' means all boards. Set once from the SSR route; board
   * switching itself happens through the server-rendered rail links. */
  const [board] = useState(initialBoard);
  const [sort, setSort] = useState<Sort>('last_activity');
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('');
  /** Reply drafts hold editor HTML; images ride the attachment strip and
   *  merge into the submitted content. */
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyImages, setReplyImages] = useState<Record<number, string[]>>({});
  const [replyUploadingId, setReplyUploadingId] = useState<number | null>(null);
  const [replyBusy, setReplyBusy] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [replies, setReplies] = useState<Record<number, ReplyCache>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  /** Replies render 5 by default; 加载更多 reveals the rest (and pulls the
   *  next page when the backend's 50-per-page window has more). */
  const [revealAll, setRevealAll] = useState<Record<number, boolean>>({});
  /** Shared lightbox gallery: images stay mounted while closing so the
   *  fade-out animation has content. */
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    index: number;
    images: { src: string; alt?: string }[];
  }>({ open: false, index: 0, images: [] });
  const openLightbox = (images: FeedThread['images'], index: number) =>
    setLightbox({
      open: true,
      index,
      images: images.map((im) => ({ src: im.url, alt: im.alt || undefined })),
    });
  /** Keyword filter — typed in the loop toolbar, debounced fetch. */
  const [search, setSearch] = useState('');
  const searchTimer = useRef<number | null>(null);
  /** Monotonic guard for feed mutations — responses of superseded requests
   *  (page fetch or auto-append) are dropped instead of applied. */
  const feedSeq = useRef(0);
  /** Single-flight slot the fresh fetch and the auto-append share. The
   *  append bumps the sequence once it starts, so an unsupervised refresh
   *  racing it would have its response dropped and the stale page-2 shape
   *  would win (sort/search clicks visibly ignored). While one runs, the
   *  other queues here — newest click wins the slot. */
  const busyRef = useRef(false);
  const queuedFetch = useRef<{ board: string; sort: Sort; q: string } | null>(null);
  const stateRef = useRef({ threads, pagination, board, sort, search });
  stateRef.current = { threads, pagination, board, sort, search };

  const fetchFeed = useCallback(async (board: string, sort: Sort, q: string) => {
    if (busyRef.current) {
      queuedFetch.current = { board, sort, q };
      return;
    }
    busyRef.current = true;
    // Sequence guard: a slower older response (board/sort/search/append race)
    // must never overwrite the newest feed state.
    const seq = ++feedSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (board) params.set('board', board);
      if (sort !== 'last_activity') params.set('sort', sort);
      if (q) params.set('q', q);
      const response = await fetch(`/api/discussions/${params.size ? `?${params}` : ''}`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        items?: FeedThread[];
        pagination?: PageMeta;
      } | null;
      if (seq !== feedSeq.current) return;
      if (json?.ok && json.items && json.pagination) {
        setThreads(json.items);
        setPagination(json.pagination);
      }
    } finally {
      busyRef.current = false;
      const queued = queuedFetch.current;
      queuedFetch.current = null;
      if (queued) {
        // The click outranks the append that just finished: reload fresh.
        void fetchFeed(queued.board, queued.sort, queued.q);
      } else if (seq === feedSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  /** Search box input: updates the field now, refetches debounced. Also the
   *  entry point for tag clicks — the tag keyword rides into the box. */
  const onSearchInput = (value: string) => {
    setSearch(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void fetchFeed(stateRef.current.board, stateRef.current.sort, value);
    }, 400);
  };

  useEffect(
    () => () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    },
    [],
  );

  const switchSort = (next: Sort) => {
    if (next === stateRef.current.sort) return;
    setSort(next);
    void fetchFeed(stateRef.current.board, next, stateRef.current.search);
  };

  /**
   * Auto-append: sentinel observation and re-arm live in the shared hook;
   * this island owns the fetch itself (single-flight + queue + sequence).
   */
  const appendNext = useCallback(() => {
    if (busyRef.current) return;
    const s = stateRef.current;
    if (!s.pagination.hasNext) return;
    busyRef.current = true;
    const seq = ++feedSeq.current;
    setLoading(true);
    void (async () => {
      let ok = false;
      try {
        const params = new URLSearchParams();
        if (s.board) params.set('board', s.board);
        if (s.sort !== 'last_activity') params.set('sort', s.sort);
        if (s.search) params.set('q', s.search);
        params.set('page', String(s.pagination.page + 1));
        const response = await fetch(`/api/discussions/?${params}`);
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          items?: FeedThread[];
          pagination?: PageMeta;
        } | null;
        if (seq !== feedSeq.current) return;
        if (json?.ok && json.items && json.pagination) {
          ok = true;
          setThreads((prev) => [...prev, ...(json.items ?? [])]);
          setPagination(json.pagination);
        }
      } finally {
        busyRef.current = false;
        const queued = queuedFetch.current;
        queuedFetch.current = null;
        if (queued) {
          // A board/sort/search click landed while this append was in
          // flight — it queued through fetchFeed and is the authoritative
          // next fetch (same drain as fetchFeed's own finally). Skip the
          // re-arm: this append's page belongs to the superseded query.
          void fetchFeed(queued.board, queued.sort, queued.q);
        } else {
          if (seq === feedSeq.current) setLoading(false);
          rearm(ok);
        }
      }
    })();
  }, []);

  const { sentinelRef, rearm } = useInfiniteScroll({ enabled: true, start: appendNext });

  // ---------- composer ----------
  const [draftHtml, setDraftHtml] = useState('');
  /** True while an upload is in flight (spinner tile in the strip). */
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draftKey, setDraftKey] = useState(0);
  /** Uploaded attachment srcs — merged into the content on publish. */
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const hasDraft = composerImages.length > 0 || htmlHasContent(draftHtml);

  const onPickImage = (file: File) => {
    setUploadingImage(true);
    void uploadImage(file).then((url) => {
      if (url) setComposerImages((prev) => [...prev, url]);
      else toastApiError(null, locale);
      setUploadingImage(false);
    });
  };

  const removeComposerImage = (index: number) => {
    setComposerImages((prev) => prev.filter((_, i) => i !== index));
  };

  const publish = async () => {
    if (publishing || !hasDraft) return;
    setPublishing(true);
    try {
      const content = draftHtml + composerImages.map((url) => `<img src="${url}">`).join('');
      const response = await fetch('/api/discussions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), board: composerBoard, content }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
      } | null;
      if (json?.ok) {
        // Remount the editor empty (key bump) and refresh the SSR feed.
        setDraftHtml('');
        setDraftKey((k) => k + 1);
        setTitle('');
        setComposerImages([]);
        await fetchFeed(stateRef.current.board, stateRef.current.sort, stateRef.current.search);
      } else {
        toastApiError(json?.code ?? null, locale);
      }
    } catch {
      // Network-level rejection: the fetch itself threw — same user message.
      toastApiError(null, locale);
    } finally {
      setPublishing(false);
    }
  };

  // ---------- replies ----------
  const toggleReplies = (thread: FeedThread) => {
    const open = !!expanded[thread.id];
    setExpanded((prev) => ({ ...prev, [thread.id]: !open }));
    if (open || replies[thread.id]?.loaded) return;
    setReplies((prev) => ({
      ...prev,
      [thread.id]: { items: [], page: 0, hasNext: false, loading: true, loaded: false },
    }));
    void (async () => {
      try {
        const response = await fetch(`/api/discussions/${thread.id}/replies/?page=1`);
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          items?: FeedReply[];
          pagination?: PageMeta;
        } | null;
        setReplies((prev) => ({
          ...prev,
          [thread.id]: {
            items: json?.items ?? [],
            page: 1,
            hasNext: json?.pagination?.hasNext ?? false,
            loading: false,
            loaded: true,
          },
        }));
      } catch {
        // A dead network must not park the row spinner; the shape matches
        // the failed-response path and the toast carries the reason.
        setReplies((prev) => ({
          ...prev,
          [thread.id]: {
            items: [],
            page: 1,
            hasNext: false,
            loading: false,
            loaded: true,
          },
        }));
        toastApiError(null, locale);
      }
    })();
  };

  /** 加载更多: reveal the already-fetched replies beyond the first three and
   *  pull the next page when the backend window (50/page) has more. */
  const loadMoreReplies = (threadId: number) => {
    setRevealAll((prev) => ({ ...prev, [threadId]: true }));
    const cache = replies[threadId];
    if (!cache || !cache.hasNext || cache.loading) return;
    setReplies((prev) => ({ ...prev, [threadId]: { ...cache, loading: true } }));
    void (async () => {
      try {
        const response = await fetch(
          `/api/discussions/${threadId}/replies/?page=${cache.page + 1}`,
        );
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          items?: FeedReply[];
          pagination?: PageMeta;
        } | null;
        setReplies((prev) => ({
          ...prev,
          [threadId]: {
            items: [...cache.items, ...(json?.items ?? [])],
            page: cache.page + 1,
            hasNext: json?.pagination?.hasNext ?? false,
            loading: false,
            loaded: true,
          },
        }));
      } catch {
        // Keep the already-loaded page and the button alive for a retry.
        setReplies((prev) => ({
          ...prev,
          [threadId]: { ...cache, loading: false },
        }));
        toastApiError(null, locale);
      }
    })();
  };

  /** Reply editor has content when its HTML carries text or attachments. */
  const replyHasContent = (threadId: number) => {
    const html = replyDrafts[threadId] ?? '';
    return htmlHasContent(html) || (replyImages[threadId]?.length ?? 0) > 0;
  };

  const onReplyImage = (threadId: number, file: File) => {
    setReplyUploadingId(threadId);
    void uploadImage(file).then((url) => {
      if (url)
        setReplyImages((prev) => ({ ...prev, [threadId]: [...(prev[threadId] ?? []), url] }));
      else toastApiError(null, locale);
      setReplyUploadingId(null);
    });
  };

  const removeReplyImage = (threadId: number, index: number) => {
    setReplyImages((prev) => ({
      ...prev,
      [threadId]: (prev[threadId] ?? []).filter((_, i) => i !== index),
    }));
  };

  const submitReply = async (thread: FeedThread) => {
    if (replyBusy === thread.id || !replyHasContent(thread.id)) return;
    setReplyBusy(thread.id);
    try {
      const images = replyImages[thread.id] ?? [];
      const content =
        (replyDrafts[thread.id] ?? '') + images.map((url) => `<img src="${url}">`).join('');
      const response = await fetch(`/api/discussions/${thread.id}/replies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        reply?: FeedReply;
        code?: string;
      } | null;
      if (json?.ok && json.reply) {
        setReplyDrafts((prev) => ({ ...prev, [thread.id]: '' }));
        setReplyImages((prev) => ({ ...prev, [thread.id]: [] }));
        // Show the visitor their own reply even when the list was truncated.
        setRevealAll((prev) => ({ ...prev, [thread.id]: true }));
        setThreads((prev) =>
          prev.map((t) => (t.id === thread.id ? { ...t, replies: t.replies + 1 } : t)),
        );
        const cache = replies[thread.id];
        setReplies((prev) => ({
          ...prev,
          [thread.id]: {
            items: [...(cache?.items ?? []), json.reply as FeedReply],
            page: cache?.page ?? 1,
            hasNext: cache?.hasNext ?? false,
            loading: false,
            loaded: true,
          },
        }));
      } else {
        toastApiError(json?.code ?? null, locale);
      }
    } catch {
      toastApiError(null, locale);
    } finally {
      setReplyBusy(null);
    }
  };

  const deleteReply = async (threadId: number, replyId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/discussions/${threadId}/replies/${replyId}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { code?: string } | null;
        toastApiError(json?.code ?? null, locale);
        return false;
      }
    } catch {
      // Network-level failure: same feedback as a refused delete, and the
      // confirm popover stays open for a retry instead of an unhandled
      // rejection.
      toastApiError(null, locale);
      return false;
    }
    setReplies((prev) => ({
      ...prev,
      [threadId]: prev[threadId]
        ? { ...prev[threadId], items: prev[threadId].items.filter((r) => r.id !== replyId) }
        : prev[threadId],
    }));
    // The footer count mirrors thread.replies — keep it in step locally.
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, replies: Math.max(0, t.replies - 1) } : t)),
    );
    return true;
  };

  const deleteThread = async (thread: FeedThread): Promise<boolean> => {
    try {
      const response = await fetch(`/api/discussions/${thread.id}/`, { method: 'DELETE' });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { code?: string } | null;
        toastApiError(json?.code ?? null, locale);
        return false;
      }
    } catch {
      toastApiError(null, locale);
      return false;
    }
    setThreads((prev) => prev.filter((t) => t.id !== thread.id));
    return true;
  };

  // ---------- render ----------
  return (
    <div>
      {/* Composer: the shared title+body editor block, actions below. The
          Card wraps the layout only — the editor block keeps its own single
          border so edit mode (inside a thread card) never nests two. */}
      {canPost ? (
        <Card className="p-3 sm:p-4">
          <PostEditorBlock
            mode="composer"
            title={title}
            onTitleChange={setTitle}
            initialHtml={draftHtml}
            onHtmlChange={setDraftHtml}
            editorKey={draftKey}
            bodyPlaceholder={copy.composerPlaceholder}
            onImageFile={onPickImage}
            images={composerImages}
            onRemoveImage={removeComposerImage}
            uploading={uploadingImage}
            labels={{
              title: copy.titleLabel,
              titleOptional: copy.titleOptional,
              bold: copy.bold,
              italic: copy.italic,
              underline: copy.underline,
              strike: copy.strike,
              quote: copy.quote,
              spoiler: copy.spoiler,
              image: copy.imageUpload,
              smile: copy.smilies,
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            {boards.length > 0 ? (
              <Select value={composerBoard} onValueChange={setComposerBoard}>
                <SelectTrigger
                  size="sm"
                  className="w-[150px] bg-surface text-xs font-normal"
                  aria-label={copy.boardFilter}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((candidate) => (
                    <SelectItem key={candidate.slug} value={candidate.slug}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-body-muted">{copy.noBoardNotice}</span>
            )}
            <Button size="sm" onClick={() => void publish()} disabled={publishing || !hasDraft}>
              {publishing ? (
                <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <SquarePenIcon className="size-3.5" aria-hidden="true" />
              )}
              {copy.publish}
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyNote onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-auth'))}>
          {copy.loginToPost}
        </EmptyNote>
      )}

      {/* Feed toolbar: titled brand mark on the left; sort sits immediately
          left of the search box on the right. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 font-display text-base font-semibold text-foreground">
          <MessageSquareIcon className="size-5 text-primary" aria-hidden="true" />
          {copy.title}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(value) => switchSort(value as Sort)}>
            <SelectTrigger
              size="sm"
              className="w-[92px] shrink-0 bg-surface text-xs font-normal"
              aria-label={`${copy.sortLastActivity} / ${copy.sortNewest}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_activity">{copy.sortLastActivity}</SelectItem>
              <SelectItem value="newest">{copy.sortNewest}</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-44 lg:w-52">
            <SearchIcon
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-body-muted"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => onSearchInput(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="h-8 bg-surface pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Feed */}
      <div
        className={
          loading
            ? 'mt-3 flex flex-col gap-4 opacity-60 transition-opacity'
            : 'mt-3 flex flex-col gap-4 transition-opacity'
        }
      >
        {threads.map((thread) => {
          const open = !!expanded[thread.id];
          const cache = replies[thread.id];
          return (
            <Card key={thread.id}>
              {/* Weibo-style card. Mobile: avatar + author/meta header row,
                  then title/body full-width below (no reserved avatar-column
                  indent, no edge-hugging avatar). Desktop (sm+): the body
                  indents back into the name column (sm:pl-[68px] = 16px card
                  padding + 40px avatar + 12px gap). */}
              <div className="flex items-start gap-2.5 px-3 pt-3 sm:gap-3 sm:px-4 sm:pt-4">
                <Avatar
                  name={thread.author.name}
                  url={thread.author.avatar?.url ?? null}
                  className="size-8 text-sm sm:size-10 sm:text-base"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground sm:text-base">
                    {thread.author.name}
                  </span>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-body-muted">
                    {thread.board && (
                      <span className="rounded-full bg-secondary px-1.5 py-px text-[11px] text-body-muted">
                        {thread.board.name}
                      </span>
                    )}
                    <span>{displayDate(thread.publishedAt, locale, timezone)}</span>
                  </div>
                </div>
              </div>
              {editingId === thread.id ? (
                /* Edit mode swaps the rendered text for the shared editor
                   block, in place — no dropdown involvement. */
                <div className="px-3 pt-2 pb-3 sm:px-4 sm:pb-4 sm:pl-[68px]">
                  <ThreadEditForm
                    thread={thread}
                    locale={locale}
                    onSaved={() => {
                      setEditingId(null);
                      void fetchFeed(
                        stateRef.current.board,
                        stateRef.current.sort,
                        stateRef.current.search,
                      );
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div className="px-3 pb-3 sm:px-4 sm:pb-4 sm:pl-[68px]">
                  {thread.title !== '' && (
                    <h2 className="mt-2 font-display text-[15px] font-semibold leading-snug text-foreground">
                      {thread.title}
                    </h2>
                  )}
                  {thread.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {thread.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="text-sm text-primary hover:underline"
                          title={copy.searchPlaceholder}
                          onClick={() => onSearchInput(`#${tag}#`)}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div
                    className="prose-community mt-1.5 text-sm leading-relaxed text-foreground"
                    dangerouslySetInnerHTML={{ __html: thread.contentSafe }}
                  />
                  {thread.images.length > 0 && (
                    <div className="mt-2.5">
                      <ImageGrid
                        images={thread.images}
                        onOpen={(index) => openLightbox(thread.images, index)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Action bar: replies toggle on the left; tags and the
                  text-labelled edit/delete actions on the right. */}
              <div className="flex items-center gap-2 border-t border-border px-3 py-1.5 text-xs text-body-muted">
                <button
                  type="button"
                  className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary hover:text-foreground"
                  aria-expanded={open}
                  onClick={() => toggleReplies(thread)}
                >
                  <MessageSquareIcon className="size-3.5" aria-hidden="true" />
                  {copy.repliesTitle}
                  {thread.replies > 0 && <span className="tabular-nums">{thread.replies}</span>}
                  <ChevronDownIcon
                    className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <div className="ml-auto flex items-center gap-1">
                  {/* Hidden while editing — the editor block already has its
                      own cancel button; showing a second one misleads. */}
                  {thread.canEdit && editingId !== thread.id && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary hover:text-foreground"
                      onClick={() => setEditingId(thread.id)}
                    >
                      <PencilIcon className="size-3.5" aria-hidden="true" />
                      {copy.edit}
                    </button>
                  )}
                  {thread.canDelete && (
                    <ConfirmPopover
                      text={copy.deleteConfirmDesc}
                      cancelLabel={copy.cancel}
                      confirmLabel={copy.delete}
                      onConfirm={() => deleteThread(thread)}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-error transition-colors hover:bg-secondary hover:text-error"
                      >
                        <Trash2Icon className="size-3.5" aria-hidden="true" />
                        {copy.delete}
                      </button>
                    </ConfirmPopover>
                  )}
                </div>
              </div>

              {open && (
                <div className="px-3 py-3 sm:px-4">
                  {!cache?.loaded ? (
                    <Spinner label={copy.loading} />
                  ) : (
                    <>
                      {cache.items.length === 0 && (
                        <p className="py-2 text-xs text-body-muted">{copy.repliesEmpty}</p>
                      )}
                      <ul className="flex flex-col gap-4">
                        {(revealAll[thread.id] ? cache.items : cache.items.slice(0, 5)).map(
                          (reply) => (
                            <li key={reply.id} className="flex items-start gap-2.5">
                              <Avatar
                                name={reply.author.name}
                                url={reply.author.avatar?.url ?? null}
                                className="size-9 text-sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 text-xs text-body-muted">
                                  <span className="font-medium text-foreground">
                                    {reply.author.name}
                                  </span>
                                  <span>{displayDate(reply.publishedAt, locale, timezone)}</span>
                                  {reply.canDelete && (
                                    <ConfirmPopover
                                      text={copy.deleteConfirmDesc}
                                      cancelLabel={copy.cancel}
                                      confirmLabel={copy.delete}
                                      onConfirm={() => deleteReply(thread.id, reply.id)}
                                    >
                                      <button type="button" className="text-error hover:opacity-80">
                                        {copy.delete}
                                      </button>
                                    </ConfirmPopover>
                                  )}
                                </div>
                                {/* Light-gray text bubble for the reply body
                                    (secondary at half strength keeps it soft).
                                    Rich HTML via the sanitizer; legacy
                                    plain-text replies keep their newlines. */}
                                <div className="mt-1 rounded-lg bg-secondary/50 px-3 py-2">
                                  <div
                                    className="prose-community whitespace-pre-line text-sm leading-relaxed text-foreground"
                                    dangerouslySetInnerHTML={{ __html: reply.contentSafe }}
                                  />
                                  {reply.images.length > 0 && (
                                    <div className="mt-1.5">
                                      <ImageGrid
                                        images={reply.images}
                                        onOpen={(index) => openLightbox(reply.images, index)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </li>
                          ),
                        )}
                      </ul>
                      {(revealAll[thread.id]
                        ? cache.hasNext
                        : cache.items.length > 5 || cache.hasNext) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full"
                          disabled={cache.loading}
                          onClick={() => loadMoreReplies(thread.id)}
                        >
                          {cache.loading ? <Spinner label={copy.loading} /> : copy.loadMore}
                        </Button>
                      )}
                      {/* Separate composer: the visitor's own identity on the
                          left, the shared Tiptap editor + attachment strip on
                          the right — same experience as the feed composer. */}
                      {thread.canReply && (
                        <div className="mt-3 flex items-start gap-2.5 border-t border-border pt-3">
                          <Avatar
                            name={user?.name ?? ''}
                            url={user?.avatarUrl ?? null}
                            className="size-9 text-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <RichEditor
                              initialHtml={replyDrafts[thread.id] ?? ''}
                              onChange={(html) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [thread.id]: html,
                                }))
                              }
                              placeholder={copy.replyPlaceholder}
                              onImageFile={(file) => onReplyImage(thread.id, file)}
                              labels={{
                                bold: copy.bold,
                                italic: copy.italic,
                                underline: copy.underline,
                                strike: copy.strike,
                                quote: copy.quote,
                                spoiler: copy.spoiler,
                                image: copy.imageUpload,
                                smile: copy.smilies,
                              }}
                            />
                            <AttachmentStrip
                              images={replyImages[thread.id] ?? []}
                              onRemove={(index) => removeReplyImage(thread.id, index)}
                              uploading={replyUploadingId === thread.id}
                            />
                            <div className="mt-2 flex justify-end">
                              <Button
                                size="sm"
                                disabled={replyBusy === thread.id || !replyHasContent(thread.id)}
                                onClick={() => void submitReply(thread)}
                              >
                                {replyBusy === thread.id ? (
                                  <LoaderCircleIcon
                                    className="size-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <SquarePenIcon className="size-3.5" aria-hidden="true" />
                                )}
                                {copy.publish}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {threads.length === 0 && <EmptyNote className="px-6 py-8">{copy.listEmpty}</EmptyNote>}
      </div>

      {/* Auto-load footer: spinner while appending, end marker when done. */}
      <div ref={sentinelRef} aria-hidden="true" className="py-6 text-center">
        {loading ? (
          <Spinner label={copy.loading} />
        ) : (
          !pagination.hasNext && <span className="text-xs text-body-muted">{copy.noMore}</span>
        )}
      </div>

      {/* Shared image lightbox: zoom + counter (counter only for galleries).
          Viewer.js-like defaults — natural size when it fits, slight downscale
          (4% slide padding) when it exceeds the viewport; tinted, non-black
          backdrop that closes on click. */}
      <Lightbox
        open={lightbox.open}
        index={lightbox.index}
        slides={lightbox.images}
        close={() => setLightbox((prev) => ({ ...prev, open: false }))}
        plugins={lightbox.images.length > 1 ? [Zoom, Counter] : [Zoom]}
        animation={{ zoom: 300 }}
        controller={{ closeOnBackdropClick: true }}
        carousel={{ padding: '4%' }}
        styles={{ container: { backgroundColor: 'var(--scrim-immersive)' } }}
      />
    </div>
  );
}

export default function CommunityFeed(props: Props) {
  return (
    <FeedErrorBoundary>
      <CommunityFeedInner {...props} />
    </FeedErrorBoundary>
  );
}

/** Inline title+body edit for the author/admins (PATCH proxy). */
function ThreadEditForm({
  thread,
  locale,
  onSaved,
  onCancel,
}: {
  thread: FeedThread;
  locale: Locale;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const copy = t(locale).community;
  const [title, setTitle] = useState(thread.title);
  const [content, setContent] = useState(thread.contentSafe);
  const [busy, setBusy] = useState(false);
  /** Existing thread images preloaded; uploads append here. On save the
   *  whole strip is merged back into the content HTML. */
  const [images, setImages] = useState<string[]>(thread.images.map((image) => image.url));
  const [uploading, setUploading] = useState(false);

  const onPickImage = (file: File) => {
    setUploading(true);
    void uploadImage(file).then((url) => {
      if (url) setImages((prev) => [...prev, url]);
      else toastApiError(null, locale);
      setUploading(false);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setBusy(true);
    try {
      const contentWithImages = content + images.map((url) => `<img src="${url}">`).join('');
      const response = await fetch(`/api/discussions/${thread.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: contentWithImages }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        code?: string;
      } | null;
      if (json?.ok) {
        // The parent refetches with its own board/sort/search context.
        onSaved();
      } else {
        toastApiError(json?.code ?? null, locale);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <PostEditorBlock
        mode="edit"
        title={title}
        onTitleChange={setTitle}
        initialHtml={content}
        onHtmlChange={setContent}
        images={images}
        onRemoveImage={removeImage}
        uploading={uploading}
        onImageFile={onPickImage}
        labels={{
          title: copy.titleLabel,
          titleOptional: copy.titleOptional,
          bold: copy.bold,
          italic: copy.italic,
          underline: copy.underline,
          strike: copy.strike,
          quote: copy.quote,
          spoiler: copy.spoiler,
          image: copy.imageUpload,
          smile: copy.smilies,
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? (
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <SquarePenIcon className="size-3.5" aria-hidden="true" />
          )}
          {copy.publish}
        </Button>
      </div>
    </div>
  );
}
