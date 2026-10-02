import { useMemo, useState } from 'react';

import { LoaderCircleIcon, MessageCircleIcon, MessageSquareQuoteIcon, XIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import RichEditor, { AttachmentStrip } from '@/components/islands/user-center/RichEditor';
import { sanitizeCommentHtml } from '@/lib/content';
import Avatar from '@/components/islands/Avatar';
import type { Comment, SiteComments } from '@/lib/core/contracts';
import { displayDate } from '@/lib/format';
import { rewriteMediaUrl } from '@/lib/media';
import { t, type Locale } from '@/lib/i18n';

interface Pagination {
  page: number;
  totalPages: number;
  hasNext: boolean;
}

interface Props {
  postId: number;
  /** SSR'd first page (approved only), fetched in the window direction. */
  initial: Comment[];
  pagination: Pagination;
  total: number;
  /** Fetch window direction the initial page came in with. */
  order: 'asc' | 'desc';
  perPage: number;
  /** Display settings from /site: threading, depth, order, guest policy. */
  settings: SiteComments;
  /** Session presence; the guest gate itself comes from settings.commentRegistration. */
  loggedIn: boolean;
  /** Backend per-post switch (`commentsOpen`); false renders the composer disabled. */
  closed?: boolean;
  locale: Locale;
  /** Site calendar timezone (from /site); displayDate renders dates in it. */
  timezone?: string;
}

/** One node of the display tree: a comment plus its direct replies. */
interface CommentNode {
  comment: Comment;
  children: CommentNode[];
}

/**
 * Build the display tree from the flat API list. Threading off collapses
 * everything to top level (WP shows a flat stream in that case); replies
 * attach to their parent in chronological order as returned.
 */
function buildTree(items: Comment[], threaded: boolean): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];
  for (const comment of items) byId.set(comment.id, { comment, children: [] });
  for (const node of byId.values()) {
    const parent = threaded && node.comment.parentId ? byId.get(node.comment.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Uniform display reversal at every level (`commentOrder=desc`). */
function reverseAtDepth(nodes: CommentNode[]): CommentNode[] {
  return nodes
    .slice()
    .reverse()
    .map((node) => ({ ...node, children: reverseAtDepth(node.children) }));
}

/**
 * Per-page display order for `commentOrder=desc`: each page's window reads
 * reversed (newest first), pages themselves stay newest-window → oldest.
 * Replies whose parent lives on another page surface as top-level entries
 * inside their own page — the accepted cost of windowed threading.
 */
function reversePages(pages: Comment[][], threaded: boolean): CommentNode[] {
  return pages.flatMap((page) => reverseAtDepth(buildTree(page, threaded)));
}

/**
 * Post comment section island: renders the SSR'd first page structured by
 * the site's discussion settings (threading + depth, display order), loads
 * deeper windows through the same-origin proxy, and hosts the shared
 * tiptap composer. Logged-in writers can upload images (attachment strip
 * merged on submit); guests compose when the site's login-only switch is
 * off, identifying through the native name/email fields — the image button
 * is theirs alone, so it simply never renders for guests.
 */
export default function CommentSection({
  postId,
  initial,
  pagination,
  total,
  order,
  perPage,
  settings,
  loggedIn,
  closed = false,
  locale,
  timezone,
}: Props) {
  const copy = t(locale).comments;
  const community = t(locale).community;
  const editorLabels = {
    bold: community.bold,
    italic: community.italic,
    underline: community.underline,
    strike: community.strike,
    quote: community.quote,
    spoiler: community.spoiler,
    image: community.imageUpload,
    smile: copy.smilies,
  };

  // One slot per fetched page: `commentOrder=desc` windows come newest
  // first, so display order reverses WITHIN a page — a whole-array reversal
  // would hoist an older page above the newer one after "load more".
  const [pages, setPages] = useState<Comment[][]>([initial]);
  const [page, setPage] = useState(pagination.page);
  const [hasNext, setHasNext] = useState(pagination.hasNext);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [html, setHtml] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Display tree: threading collapses to a flat stream when off, the
  // depth cap folds deeper replies onto the last visible level, and the
  // display order reverses every level when the site wants newest-first.
  const tree = useMemo(
    () => buildTree(pages.flat(), settings.threadComments),
    [pages, settings.threadComments],
  );
  const ordered = useMemo(() => {
    if (settings.commentOrder !== 'desc') return tree;
    // Reverse within each fetched page's own window only: page N+1 is an
    // OLDER window (desc mode), so it must render after page N, not above.
    return reversePages(pages, settings.threadComments);
  }, [pages, tree, settings.commentOrder]);

  const canComment = !closed && (loggedIn || !settings.commentRegistration);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/content/${postId}/comments/?page=${page + 1}&perPage=${perPage}&order=${order}`,
      );
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        items?: Comment[];
        pagination?: Pagination;
      } | null;
      if (json?.ok && json.items) {
        setPages((prev) => [...prev, json.items ?? []]);
        setPage(json.pagination?.page ?? page + 1);
        setHasNext(json.pagination?.hasNext ?? false);
      }
    } catch {
      /* keep current list */
    } finally {
      setLoadingMore(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('image', file);
      const response = await fetch('/api/uploads/image/', { method: 'POST', body: form });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        code?: string;
      } | null;
      if (json?.ok && json.url) setImages((prev) => [...prev, json.url ?? '']);
      else setError(copy.uploadFailed);
    } catch {
      setError(copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const attachments = images.map((src) => `<img src="${src}" alt="" />`).join('\n');
    const body = [html, attachments].filter(Boolean).join('\n');
    if (body.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${postId}/comments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          parentId: replyTo?.id,
          ...(loggedIn ? {} : { authorName: guestName, authorEmail: guestEmail }),
        }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        created?: boolean;
        status?: string;
        code?: string;
      } | null;
      if (json?.ok && json.created) {
        setHtml('');
        setImages([]);
        setReplyTo(null);
        if (json.status === 'held') {
          setNotice(copy.heldNotice);
        } else {
          window.location.reload(); // approved: SSR re-renders with the new comment
          return;
        }
      } else if (json?.code === 'aiya_identity_required') {
        setError(copy.identityRequired);
      } else if (json?.code === 'aiya_comments_closed') {
        setError(copy.closed);
      } else {
        setError(copy.failed);
      }
    } catch {
      setError(copy.failed);
    } finally {
      setBusy(false);
    }
  };

  /** Depth-folded render: levels beyond the cap stay at the last indent. */
  const renderNodes = (nodes: CommentNode[], level: number) => {
    const depth = Math.min(level, Math.max(0, settings.threadCommentsDepth - 1));
    return nodes.map((node) => (
      <div
        key={node.comment.id}
        id={`comment-${node.comment.id}`}
        className={depth > 0 ? 'ml-4 border-l border-border pl-4' : ''}
      >
        <CommentCard
          comment={node.comment}
          locale={locale}
          timezone={timezone}
          onReply={canComment ? () => setReplyTo(node.comment) : undefined}
        />
        {node.children.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">{renderNodes(node.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <MessageCircleIcon className="size-5" aria-hidden="true" />
        {copy.title}
        <Badge variant="secondary">{total}</Badge>
      </h2>

      {/* Composer (or its disabled/login states) leads the section. */}
      {closed ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-center text-sm text-body-muted">{copy.closed}</p>
        </div>
      ) : canComment ? (
        <Card className="p-4">
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
            {!loggedIn && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder={copy.guestName}
                  aria-label={copy.guestName}
                  maxLength={245}
                  required={settings.requireNameEmail}
                />
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  placeholder={copy.guestEmail}
                  aria-label={copy.guestEmail}
                  maxLength={254}
                  required={settings.requireNameEmail}
                />
              </div>
            )}
            {replyTo && (
              <div className="flex items-center gap-2 self-start rounded-md bg-secondary px-2.5 py-1 text-xs text-body-muted">
                <MessageSquareQuoteIcon className="size-3.5" aria-hidden="true" />
                <span>
                  {copy.replyingTo} @{replyTo.author.name}
                </span>
                <button
                  type="button"
                  aria-label="×"
                  onClick={() => setReplyTo(null)}
                  className="hover:text-foreground"
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </div>
            )}
            <RichEditor
              initialHtml={html}
              onChange={setHtml}
              placeholder={replyTo ? copy.replyPlaceholder : copy.composerPlaceholder}
              onImageFile={loggedIn ? (file) => void upload(file) : undefined}
              labels={editorLabels}
            />
            {(images.length > 0 || uploading) && (
              <AttachmentStrip
                images={images}
                uploading={uploading}
                onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
              />
            )}
            <div className="flex items-center justify-between gap-3">
              {notice ? (
                <p role="status" className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {notice}
                </p>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  copy.submit
                )}
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
          </form>
        </Card>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-center text-sm text-body-muted">
            {copy.loginRequired}
            {!loggedIn && (
              <Button
                variant="link"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-auth'))}
              >
                {t(locale).shell.login}
              </Button>
            )}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3" data-comment-list>
        {pages.flat().length === 0 && total === 0 ? (
          <Empty className="rounded-lg border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircleIcon />
              </EmptyMedia>
              <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
              <EmptyDescription>{copy.empty}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          renderNodes(ordered, 0)
        )}
        {hasNext && (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            className="self-start"
            onClick={() => void loadMore()}
          >
            {loadingMore ? '…' : copy.loadMore}
          </Button>
        )}
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  locale,
  timezone,
  onReply,
}: {
  comment: Comment;
  locale: Locale;
  timezone?: string;
  onReply?: () => void;
}) {
  const copy = t(locale).comments;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm">
        <Avatar
          url={comment.author.avatar ? rewriteMediaUrl(comment.author.avatar) : null}
          name={comment.author.name}
          className="size-[22px] text-[10px]"
        />
        <span className="font-medium text-foreground">{comment.author.name}</span>
        {comment.publishedAt && (
          <span className="text-xs text-body-muted">
            {displayDate(comment.publishedAt, locale, timezone)}
          </span>
        )}
        {onReply && (
          <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={onReply}>
            {copy.reply}
          </Button>
        )}
      </div>
      <div
        className="aiya-comment-body mt-2 text-sm leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.bodyHtml) }}
      />
    </div>
  );
}
