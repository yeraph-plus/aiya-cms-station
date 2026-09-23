import { useState } from 'react';

import {
  LoaderCircleIcon,
  MessageCircleIcon,
  MessageSquareDotIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PostEditorBlock } from '@/components/islands/user-center/RichEditor';
import { t, type Locale } from '@/lib/i18n';
import { displayDate } from '@/lib/format';
import type { FeedThread } from '@/lib/community';

interface PageMeta {
  page: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** How many bound threads the sidebar shows (matches the SSR fetch). */
const SIDEBAR_LIMIT = 5;

export interface PostDiscussionsProps {
  /** The post/resource the threads bind to (and new threads will bind to). */
  postId: number;
  /** Cloaked bound threads, SSR-fetched; refreshed client-side on publish. */
  initialThreads: FeedThread[];
  initialTotal: number;
  /** Boards for the composer's target picker (slug + name suffice). */
  boards: { slug: string; name: string }[];
  /** Guests get the login dialog via the `aiya:open-auth` bridge instead. */
  canPost: boolean;
  locale: Locale;
}

/** Same upload path as the community feed composer: same-origin proxy in,
 *  cloaked /media/ URL out (null on failure). */
async function uploadImageFile(file: File): Promise<string | null> {
  const form = new FormData();
  form.set('image', file);
  const response = await fetch('/api/uploads/image/', { method: 'POST', body: form });
  const json = (await response.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
  return json?.ok && json.url ? json.url : null;
}

/**
 * Sidebar part of the post/resource detail shells: the threads bound to
 * this content (`GET /discussions?post={id}` — the ticket surface for
 * broken links, update/new-release requests and errata) plus a composer
 * button opening a modal editor. New threads ride the same POST proxy as
 * the community feed with `postId` attached, so the binding happens
 * server-side and the thread renders the article card in /community/.
 * Body templates prefill the editor: picking one replaces the draft.
 */
export default function PostDiscussions({
  postId,
  initialThreads,
  initialTotal,
  boards,
  canPost,
  locale,
}: PostDiscussionsProps) {
  const copy = t(locale);
  const community = copy.community;
  const [threads, setThreads] = useState(initialThreads);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // ---------- modal composer ----------
  const [title, setTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** '' selects no template — the composer starts blank like the feed. */
  const [template, setTemplate] = useState('');
  /** Target board; defaults to the first board like the feed composer. */
  const [board, setBoard] = useState(boards[0]?.slug ?? '');
  const hasDraft =
    images.length > 0 ||
    /<img/.test(draftHtml) ||
    draftHtml.replace(/<[^>]*>/g, '').trim() !== '';

  const templates = [
    { value: 'none', label: community.templateNone, body: '' },
    { value: 'broken-link', label: community.templateBrokenLink, body: community.templateBrokenLinkBody },
    { value: 'update-request', label: community.templateUpdateRequest, body: community.templateUpdateRequestBody },
    { value: 'new-release', label: community.templateNewRelease, body: community.templateNewReleaseBody },
    { value: 'errata', label: community.templateErrata, body: community.templateErrataBody },
  ];

  const pickTemplate = (value: string) => {
    setTemplate(value);
    // The chosen template replaces the draft body (RichEditor syncs its
    // document from initialHtml); attachments stay — removing intent
    // differs from rewriting text.
    setDraftHtml(templates.find((candidate) => candidate.value === value)?.body ?? '');
  };

  const onPickImage = (file: File) => {
    setUploading(true);
    void uploadImageFile(file).then((url) => {
      if (url) setImages((prev) => [...prev, url]);
      else toast.error(community.failed);
      setUploading(false);
    });
  };

  const resetDraft = () => {
    setTitle('');
    setDraftHtml('');
    setTemplate('');
    setImages([]);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        post: String(postId),
        perPage: String(SIDEBAR_LIMIT),
        sort: 'newest',
      });
      const response = await fetch(`/api/discussions/?${params}`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        items?: FeedThread[];
        pagination?: PageMeta;
      } | null;
      if (json?.ok && json.items && json.pagination) {
        setThreads(json.items);
        setTotal(json.pagination.totalItems);
      }
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (publishing || !hasDraft) return;
    setPublishing(true);
    try {
      const content = draftHtml + images.map((url) => `<img src="${url}">`).join('');
      const response = await fetch('/api/discussions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), board, content, postId }),
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (json?.ok) {
        setOpen(false);
        resetDraft();
        toast.success(community.published);
        await refresh();
      } else {
        toast.error(community.failed);
      }
    } finally {
      setPublishing(false);
    }
  };

  // ---------- render ----------
  return (
    <section>
      <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
        <MessageSquareDotIcon className="size-5" aria-hidden="true" />
        {community.relatedThreads}
        {total > 0 && <span className="text-sm font-normal text-body-muted tabular-nums">{total}</span>}
      </h2>
      <Button
        variant="outline"
        className="mt-3 mb-3 h-8 w-full"
        title={canPost ? undefined : community.loginToPost}
        onClick={() =>
          canPost ? setOpen(true) : window.dispatchEvent(new CustomEvent('aiya:open-auth'))
        }
      >
        <MessageSquarePlusIcon className="size-3.5" aria-hidden="true" />
        {community.startThread}
      </Button>

      {threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted">
          {community.relatedThreadsEmpty}
        </p>
      ) : (
        <div className={loading ? 'flex flex-col gap-3 opacity-60 transition-opacity' : 'flex flex-col gap-3 transition-opacity'}>
          {threads.map((thread) => (
            <SidebarThread key={thread.id} thread={thread} locale={locale} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85svh] gap-0 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{community.newThread}</DialogTitle>
            <DialogDescription>{community.bindHint}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={template} onValueChange={pickTemplate}>
                <SelectTrigger
                  size="sm"
                  className="min-w-0 flex-1 bg-surface text-xs font-normal"
                  aria-label={community.templateLabel}
                >
                  <SelectValue placeholder={community.templateLabel} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((candidate) => (
                    <SelectItem key={candidate.value} value={candidate.value}>
                      {candidate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {boards.length > 0 && (
                <Select value={board} onValueChange={setBoard}>
                  <SelectTrigger
                    size="sm"
                    className="w-[130px] shrink-0 bg-surface text-xs font-normal"
                    aria-label={community.boardFilter}
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
              )}
            </div>
            <PostEditorBlock
              mode="composer"
              title={title}
              onTitleChange={setTitle}
              initialHtml={draftHtml}
              onHtmlChange={setDraftHtml}
              bodyPlaceholder={community.composerPlaceholder}
              onImageFile={onPickImage}
              images={images}
              onRemoveImage={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
              uploading={uploading}
              labels={{
                title: community.titleLabel,
                titleOptional: community.titleOptional,
                bold: community.bold,
                italic: community.italic,
                underline: community.underline,
                strike: community.strike,
                quote: community.quote,
                spoiler: community.spoiler,
                image: community.imageUpload,
                smile: community.smilies,
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={publishing} onClick={() => setOpen(false)}>
                {community.cancel}
              </Button>
              <Button size="sm" disabled={publishing || !hasDraft} onClick={() => void publish()}>
                {publishing ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <MessageSquarePlusIcon className="size-3.5" aria-hidden="true" />
                )}
                {community.publish}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** One bound thread as a bare sidebar row: title (or excerpt) over the
 *  status/author/date/replies meta line, whole row linking into /community/. */
function SidebarThread({ thread, locale }: { thread: FeedThread; locale: Locale }) {
  const copy = t(locale).community;
  const excerpt =
    thread.title !== ''
      ? thread.title
      : thread.contentSafe.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) ||
        copy.searchPlaceholder;
  return (
    <a href={thread.url} className="group flex items-start gap-3">
      <span
        aria-hidden="true"
        className={`mt-[7px] size-1.5 flex-none rounded-full ${
          thread.status === 'open' ? 'bg-focus-blue' : 'bg-body-muted/40'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
          {excerpt}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-body-muted">
          <span>{thread.status === 'open' ? copy.status_open : copy.status_closed}</span>
          <span>{thread.author.name}</span>
          <span>{displayDate(thread.publishedAt, locale)}</span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleIcon className="size-3" aria-hidden="true" />
            {thread.replies}
          </span>
        </span>
      </span>
    </a>
  );
}
