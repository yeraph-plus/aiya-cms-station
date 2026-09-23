import { memo, useCallback, useEffect, useRef, useState } from 'react';

import Lightbox from 'yet-another-react-lightbox';
import { Counter, Zoom } from 'yet-another-react-lightbox/plugins';
import 'yet-another-react-lightbox/styles.css';

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BinaryIcon,
  CalendarIcon,
  DiscIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  FolderIcon,
  ImageIcon,
  LockIcon,
  MusicIcon,
  NewspaperIcon,
  EyeIcon,
  HeartIcon,
  MessageCircleIcon,
  LoaderCircleIcon,
  PresentationIcon,
  SendIcon,
  SettingsIcon,
  StarIcon,
  TypeIcon,
  VideoIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

import CommentSection from '@/components/islands/CommentSection';
import { FollowButton } from '@/components/islands/user-center/FollowButton';
import FavoriteButton from '@/components/islands/FavoriteButton';
import LikeButton from '@/components/islands/LikeButton';
import RatingRow from '@/components/islands/RatingRow';
import UnlockGate from '@/components/islands/UnlockGate';
import { safeContent } from '@/lib/content';
import { iconInner } from '@/lib/icons';
import { displayDate } from '@/lib/format';
import { t, type Locale } from '@/lib/i18n';
import type {
  Comment,
  FileEntry,
  FileList,
  PostDetail,
  PostSummary,
  SiteComments,
  Term,
} from '@/lib/core/contracts';

/**
 * Shared sub-islands of the three detail layout shells (posts, resources,
 * pages). Each part is a plain component — the type shells compose them,
 * and only the shell itself carries the hydration boundary. The header
 * follows the layered (hamburger) card structure: title + badges, the
 * author/date/counters row, per-vocabulary term lines, then the excerpt
 * strip — with the featured image behind the top rows when set.
 */

/** Display-state badges of one post, md scale, shadcn Badge in the inherited palette. */
export function BadgeRow({ post, locale }: { post: PostDetail; locale: Locale }) {
  const copy = t(locale).posts;
  const badges = [
    ['sticky', copy.badgeSticky],
    ['password', copy.badgePassword],
    ['private', copy.badgePrivate],
    ['member', copy.badgeMember],
    ['login', copy.badgeLogin],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges
        .filter(([key]) => post.badges.includes(key))
        .map(([, label]) => (
          <Badge key={label} variant="secondary" className="text-sm">
            {label}
          </Badge>
        ))}
    </div>
  );
}

/** Author + date + reading time + counter enumeration (hero tone inverts). */
export function MetaRow({
  post,
  locale,
  tone = 'plain',
  withReadingTime = true,
}: {
  post: PostDetail;
  locale: Locale;
  tone?: 'plain' | 'hero';
  withReadingTime?: boolean;
}) {
  const copy = t(locale).posts;
  const muted = tone === 'hero' ? 'text-white/80' : 'text-body-muted';
  const item = `inline-flex items-center gap-1 ${muted}`;
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${muted}`}>
      {post.author.avatar ? (
        <img
          src={post.author.avatar.url}
          alt={post.author.name}
          width={22}
          height={22}
          className="size-[22px] rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-[22px] items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-body-muted"
        >
          {post.author.name.slice(0, 1) || '?'}
        </span>
      )}
      <span className="font-medium">{post.author.name}</span>
      <span className={item}>
        <CalendarIcon className="size-3" aria-hidden="true" />
        {displayDate(post.publishedAt, locale)}
      </span>
      {withReadingTime && <span>{copy.readingMinutes(post.readingMinutes)}</span>}
      <span className={item}>
        <EyeIcon className="size-3" aria-hidden="true" />
        {post.metrics.views}
      </span>
      {/* Counter feature matrix: like covers post/page, rating covers
          resource — a type's disabled counters stay unlisted. */}
      {post.type !== 'resource' && (
        <span className={item}>
          <HeartIcon className="size-3" aria-hidden="true" />
          {post.metrics.likes}
        </span>
      )}
      <span className={item}>
        <MessageCircleIcon className="size-3" aria-hidden="true" />
        {post.metrics.comments}
      </span>
      {post.type === 'resource' && post.metrics.ratingScore !== null && post.metrics.ratingScore > 0 && (
        <span className={item}>
          <StarIcon className="size-3" aria-hidden="true" />
          {post.metrics.ratingScore}
        </span>
      )}
    </div>
  );
}

function TermChip({
  term,
  href,
  title,
  locale,
}: {
  term: Term;
  href: string;
  title?: string;
  locale: Locale;
}) {
  const icon = term.icon ? iconInner(term.icon) : null;
  return (
    <a
      href={href}
      title={title}
      lang={locale}
      className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-body-muted hover:text-foreground"
    >
      {icon && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: icon }}
        />
      )}
      {term.name}
    </a>
  );
}

/**
 * Row 3 — terms, one line per vocabulary: categories first, then each tag
 * vocabulary that carries terms (posts have a single tag line; resources
 * label their five custom vocabularies).
 */
export function TermRows({
  post,
  locale,
  basePath,
  tagVocabLabels,
}: {
  post: PostDetail;
  locale: Locale;
  basePath: string;
  tagVocabLabels?: Record<string, string>;
}) {
  const copy = t(locale).posts;
  const groups = new Map<string, Term[]>();
  for (const tag of post.tags) {
    const list = groups.get(tag.vocabulary) ?? [];
    list.push(tag);
    groups.set(tag.vocabulary, list);
  }
  if (post.categories.length === 0 && groups.size === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 text-sm text-body-muted">
      {post.categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex-none">{copy.category}</span>
          {post.categories.map((term) => (
            <TermChip
              key={term.id}
              term={term}
              href={`${basePath}?category=${term.slug}`}
              locale={locale}
            />
          ))}
        </div>
      )}
      {[...groups.entries()].map(([vocab, terms]) => (
        <div key={vocab} className="flex flex-wrap items-center gap-1.5">
          <span className="flex-none">{tagVocabLabels?.[vocab] ?? copy.tags}</span>
          {terms.map((term) => (
            <TermChip
              key={term.id}
              term={term}
              href={`${basePath}?tag=${term.slug}`}
              locale={locale}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Title + badges + action bar, no wrapping, actions locked right. */
function TitleRow({
  post,
  locale,
  hero,
  actions,
}: {
  post: PostDetail;
  locale: Locale;
  hero: boolean;
  actions?: React.ReactNode;
}) {
  return (
    // No wrapping: the title truncates and the action bar keeps its locked
    // spot at the right edge on every viewport.
    <div className="flex w-full flex-nowrap items-center justify-between gap-x-4">
      <div className="flex min-w-0 flex-nowrap items-center gap-x-3">
        <h1
          className={`min-w-0 truncate font-display text-2xl font-semibold leading-tight tracking-tight ${
            hero ? 'text-white drop-shadow' : 'text-foreground'
          } ${post.title === '' ? 'text-body-muted' : ''}`}
        >
          {post.title === '' ? t(locale).posts.untitled : post.title}
        </h1>
        <BadgeRow post={post} locale={locale} />
      </div>
      {actions && <div className="flex-none">{actions}</div>}
    </div>
  );
}

/**
 * The POST header: the hero area ALWAYS renders — the backend's featured
 * chain resolves the post cover, the site default post cover, or the site
 * fallback cover, so the image is practically always present; the
 * meta/title block rides the gradient at its bottom edge.
 */
export function ArticleHeader({
  post,
  locale,
  basePath,
  tagVocabLabels,
  actions,
}: {
  post: PostDetail;
  locale: Locale;
  basePath: string;
  tagVocabLabels?: Record<string, string>;
  /** The action bar (like/rating + favorite) at the title row's right. */
  actions?: React.ReactNode;
}) {
  const hero = post.featured;
  return (
    <header>
      <div className="relative">
        {hero && (
          <>
            {/* In flow, so the block keeps the backend's 1000x240 hero ratio. */}
            <img
              src={hero.url}
              alt={hero.alt}
              width={hero.width ?? 1000}
              height={hero.height ?? 240}
              className="h-auto min-h-40 w-full object-cover"
              decoding="async"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
              aria-hidden="true"
            />
          </>
        )}
        <div
          className={
            hero
              ? 'absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-6 pb-5'
              : 'relative flex flex-col gap-2.5 px-6 pt-5'
          }
        >
          <MetaRow post={post} locale={locale} tone={hero ? 'hero' : 'plain'} />
          <TitleRow post={post} locale={locale} hero={hero !== null} actions={actions} />
        </div>
      </div>
      <div className="px-6 pt-4">
        <TermRows post={post} locale={locale} basePath={basePath} tagVocabLabels={tagVocabLabels} />
      </div>
      {post.hasManualExcerpt && post.excerpt !== '' && !post.gated && !post.locked && (
        <p className="mt-4 bg-muted/60 px-6 py-3 text-center text-sm leading-relaxed text-body-muted">
          {post.excerpt}
        </p>
      )}
    </header>
  );
}

/**
 * The PAGE/RESOURCE header: no hero — pages and resources keep no hero
 * settings and the backend answers no site-default cover for them, so
 * this fork renders the meta row, the title row and the term lines
 * directly on the card surface.
 */
export function SimpleHeader({
  post,
  locale,
  basePath,
  tagVocabLabels,
  actions,
}: {
  post: PostDetail;
  locale: Locale;
  basePath: string;
  tagVocabLabels?: Record<string, string>;
  actions?: React.ReactNode;
}) {
  return (
    <header>
      <div className="flex flex-col gap-2.5 px-6 pt-5">
        <TitleRow post={post} locale={locale} hero={false} actions={actions} />
        <MetaRow post={post} locale={locale} />
      </div>
      <div className="px-6 pt-4">
        <TermRows post={post} locale={locale} basePath={basePath} tagVocabLabels={tagVocabLabels} />
      </div>
      {post.hasManualExcerpt && post.excerpt !== '' && !post.gated && !post.locked && (
        <p className="mt-4 bg-muted/60 px-6 py-3 text-center text-sm leading-relaxed text-body-muted">
          {post.excerpt}
        </p>
      )}
    </header>
  );
}

/**
 * Row 5+ — the body region with its three gate states: the visibility
 * gate outranks the password lock (an unqualified viewer cannot unlock
 * their way past it — the backend keeps the body empty either way). The
 * prose container runs Tailwind Typography with CJK-friendly leading and
 * justification; the clipboard slot markers bind their copy buttons here.
 */
/** One lightbox gallery, shared with the community surface's component. */
export interface DetailGallery {
  open: boolean;
  index: number;
  slides: { src: string; alt?: string }[];
}

/** Slides payload one DOM binding hands to the gallery. */
type GallerySlides = { src: string; alt?: string }[];

export function ArticleBody({ post, locale }: { post: PostDetail; locale: Locale }) {
  const [gallery, setGallery] = useState<DetailGallery>({ open: false, index: 0, slides: [] });
  // Stable across renders: the memoized ProseBody must never see a new
  // callback, or its bail-out would break and a gallery re-render would
  // re-set the prose innerHTML (wiping the bound listeners with it).
  const openGallery = useCallback(
    (index: number, slides: GallerySlides) => setGallery({ open: true, index, slides }),
    [],
  );
  const closeGallery = useCallback(
    () => setGallery((prev) => ({ ...prev, open: false })),
    [],
  );

  return (
    <>
      <ProseBody post={post} locale={locale} onOpenGallery={openGallery} />
      <Lightbox
        open={gallery.open}
        index={gallery.index}
        slides={gallery.slides}
        close={closeGallery}
        plugins={gallery.slides.length > 1 ? [Counter, Zoom] : [Zoom]}
        animation={{ zoom: 300 }}
        controller={{ closeOnBackdropClick: true }}
        carousel={{ padding: '4%' }}
        styles={{ container: { backgroundColor: 'rgba(15, 15, 20, 0.85)' } }}
      />
    </>
  );
}

/**
 * The memoized body DOM. A gallery open/close re-renders ArticleBody but
 * bails out here — React must not touch this subtree, because a re-set
 * `dangerouslySetInnerHTML` would replace the very image/clipboard nodes
 * this component's effect bound (the "lightbox opens once" bug).
 */
const ProseBody = memo(function ProseBody({
  post,
  locale,
  onOpenGallery,
}: {
  post: PostDetail;
  locale: Locale;
  onOpenGallery: (index: number, slides: GallerySlides) => void;
}) {
  const copy = t(locale);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prose = bodyRef.current;
    if (!prose) return;
    const copyLabel = copy.common.copy;
    const copiedLabel = copy.common.copied;
    prose.querySelectorAll('span[data-clipboard-slot]').forEach((slot) => {
      if (!(slot instanceof HTMLElement) || slot.querySelector('.clipboard-copy-btn')) return;
      const text = (slot.textContent ?? '').trim();
      if (text === '') return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'clipboard-copy-btn';
      button.textContent = copyLabel;
      button.addEventListener('click', () => {
        void navigator.clipboard?.writeText(text).then(() => {
          button.textContent = copiedLabel;
          button.dataset.copied = 'true';
          window.setTimeout(() => {
            button.textContent = copyLabel;
            button.dataset.copied = 'false';
          }, 2000);
        });
      });
      slot.appendChild(button);
    });

    // Lightbox: the backend stamps content imgs with `aiya-lightbox`
    // (smilies excluded there). Clicking opens the shared
    // yet-another-react-lightbox gallery — same viewer chrome as the
    // community feed — over the stamped images as slides. The `src`
    // attribute is the full original through the /media proxy, so the
    // viewer shows more than the inline rendition.
    const slides: { src: string; alt?: string }[] = [];
    prose.querySelectorAll('img.aiya-lightbox').forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      const index = slides.length;
      slides.push({
        src: img.getAttribute('src') ?? '',
        alt: img.getAttribute('alt') || undefined,
      });
      if (img.dataset.lightboxBound === '1') return;
      img.dataset.lightboxBound = '1';
      img.addEventListener('click', () => onOpenGallery(index, slides));
    });
  }, [post.content.html, copy.common.copy, copy.common.copied, onOpenGallery]);

  if (post.gated) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-border bg-surface px-6 py-8 text-center">
        <p className="font-medium text-foreground">
          {post.visibility === 'member'
            ? copy.posts.gatedMemberTitle
            : copy.posts.gatedLoginTitle}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-body-muted">
          {post.visibility === 'member'
            ? copy.posts.gatedMemberDescription
            : copy.posts.gatedLoginDescription}
        </p>
        {post.visibility === 'login' && (
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('aiya:open-auth'))}
          >
            {copy.shell.login}
          </button>
        )}
      </div>
    );
  }
  if (post.locked) {
    return (
      <UnlockGate
        postId={post.id}
        labels={{
          title: copy.posts.lockedTitle,
          description: copy.posts.lockedDescription,
          placeholder: copy.posts.lockedPlaceholder,
          submit: copy.posts.lockedSubmit,
          failed: copy.posts.lockedFailed,
        }}
      />
    );
  }
  return (
    <div
      ref={bodyRef}
      className="prose prose-neutral dark:prose-invert prose-content max-w-none prose-headings:font-semibold prose-p:my-3 prose-p:leading-[1.9] prose-p:text-justify prose-li:leading-[1.85] prose-a:text-primary prose-code:before:content-none prose-code:after:content-none prose-img:rounded-md"
      dangerouslySetInnerHTML={{ __html: safeContent(post.content.html) }}
    />
  );
});

/**
 * The header action bar: like (post/page) or rating (resource) plus the
 * favorite toggle, at the title row's right edge. Buttons carry their own
 * solid surfaces (rose like, white favorite) — no tone switching over
 * hero images.
 */
export function ActionRow({
  post,
  locale,
  variant,
  loggedIn,
}: {
  post: PostDetail;
  locale: Locale;
  variant: 'post' | 'resource' | 'page';
  /** Guests cannot write interactions; the controls disable upfront. */
  loggedIn: boolean;
}) {
  const copy = t(locale);
  const hint = copy.posts.interactHint;
  return (
    <div className="flex items-center gap-2">
      <FavoriteButton
        postId={post.id}
        labels={{
          favorite: copy.common.favorite,
          favorited: copy.common.favorited,
          failed: copy.common.favoriteFailed,
          removed: copy.posts.unfavorited,
          removeFailed: copy.posts.unfavoriteFailed,
        }}
        loggedIn={loggedIn}
        hint={hint}
      />
      {variant === 'resource' ? (
        <RatingRow
          postId={post.id}
          initialScore={post.metrics.ratingScore}
          initialCount={post.metrics.ratingCount}
          labels={{
            rating: copy.posts.rating,
            countText: copy.posts.ratingCount(post.metrics.ratingCount ?? 0),
            thanks: copy.posts.ratingThanks,
            failed: copy.posts.ratingFailed,
          }}
          loggedIn={loggedIn}
          hint={hint}
        />
      ) : (
        <LikeButton
          postId={post.id}
          initialLikes={post.metrics.likes}
          labels={{
            sr: copy.posts.likes,
            success: copy.posts.likeSuccess,
            failed: copy.posts.likeFailed,
          }}
          loggedIn={loggedIn}
          hint={hint}
        />
      )}
    </div>
  );
}

/**
 * Adjacent posts — a posts-only affordance (the contract nulls the pair
 * elsewhere). shadcn Card shells with the card-pipeline cover.
 */
export function PrevNextNav({ post, locale }: { post: PostDetail; locale: Locale }) {
  const copy = t(locale).posts;
  if (!post.previous && !post.next) return null;
  const card = (item: PostSummary, rel: 'prev' | 'next', label: string) => (
    <Card className="gap-0 overflow-hidden py-0 transition-colors hover:border-body-muted">
      <a href={item.url} rel={rel} className="flex items-center gap-3 p-3">
        {item.thumbnail ? (
          <img
            src={item.thumbnail.url}
            alt=""
            width={96}
            height={54}
            className="h-[54px] w-24 flex-none rounded object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="h-[54px] w-24 flex-none rounded bg-secondary" aria-hidden="true" />
        )}
        <span className="min-w-0">
          <span className="block text-xs text-body-muted">
            {rel === 'prev' ? `← ${label}` : `${label} →`}
          </span>
          <span className="mt-0.5 line-clamp-2 min-h-[2.5em] font-medium text-foreground">
            {item.title}
          </span>
        </span>
      </a>
    </Card>
  );
  return (
    <nav className="mt-10 grid gap-3 sm:grid-cols-2">
      {post.previous ? card(post.previous, 'prev', copy.prevLabel) : <span aria-hidden="true" />}
      {post.next ? card(post.next, 'next', copy.nextLabel) : <span aria-hidden="true" />}
    </nav>
  );
}

/**
 * Sidebar related list: an xl icon heading over a vertical one-per-row
 * list — bare rows (no card shells), cover left, title + date stacked to
 * its right. The section is permanent: an empty result renders a dashed
 * placeholder, so the layout holds one shape regardless of matches.
 */
export function RelatedList({
  related,
  locale,
  heading,
  emptyText,
}: {
  related: PostSummary[];
  locale: Locale;
  /** Heading override (the resource shell answers "相关资源", not "相关文章"). */
  heading?: string;
  emptyText?: string;
}) {
  const copy = t(locale);
  const items = related.slice(0, 6);
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
        <NewspaperIcon className="size-5" aria-hidden="true" />
        {heading ?? copy.posts.related}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted">
          {emptyText ?? copy.posts.relatedEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <a key={item.id} href={item.url} className="group flex items-start gap-3">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail.url}
                  alt=""
                  width={96}
                  height={56}
                  className="h-14 w-24 flex-none rounded object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="h-14 w-24 flex-none rounded bg-secondary" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 min-h-[2.75em] text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                  {item.title}
                </span>
                <span className="mt-1 flex items-center gap-2.5 text-xs text-body-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarIcon className="size-3" aria-hidden="true" />
                    {displayDate(item.publishedAt, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <EyeIcon className="size-3" aria-hidden="true" />
                    {item.metrics.views}
                  </span>
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Sidebar author card: shadcn Card shell — avatar, the bold username as
 * the profile link, the author's bio, and the follow button pinned right
 * (disabled on one's own articles).
 */
export function AuthorCard({
  post,
  bio,
  isSelf,
  locale,
}: {
  post: PostDetail;
  bio: string;
  isSelf: boolean;
  locale: Locale;
}) {
  const copy = t(locale);
  const profile = post.author.slug ? `/profile/${post.author.slug}/` : null;
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-center gap-3">
        {post.author.avatar ? (
          <img
            src={post.author.avatar.url}
            alt={post.author.name}
            width={48}
            height={48}
            className="size-12 flex-none rounded-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-12 flex-none items-center justify-center rounded-full bg-secondary text-lg font-medium text-body-muted"
          >
            {post.author.name.slice(0, 1) || '?'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {profile ? (
            <a
              href={profile}
              className="block truncate text-sm font-bold text-foreground hover:text-primary"
            >
              {post.author.name}
            </a>
          ) : (
            <p className="truncate text-sm font-bold text-foreground">{post.author.name}</p>
          )}
        </div>
        {post.author.id > 0 && (
          <div className="flex-none">
            <FollowButton
              userId={post.author.id}
              self={isSelf || !profile}
              copy={{
                follow: copy.profile.follow,
                unfollow: copy.profile.unfollow,
                loginToFollow: copy.profile.loginToFollow,
              }}
            />
          </div>
        )}
      </div>
      <p
        className={`mt-2.5 line-clamp-3 text-xs leading-relaxed ${
          bio !== '' ? 'text-body-muted' : 'text-body-muted/60'
        }`}
      >
        {bio !== '' ? bio : copy.profile.bioPlaceholder}
      </p>
    </Card>
  );
}

/** `bytes` as a short human size; null when the source reports nothing usable. */
function fileSizeText(bytes: number): string | null {
  if (bytes <= 0) return null;
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Icon category (decided by the backend from the file name) → glyph. The
 * buckets are the legacy panel's extension groups, so the map stays a plain
 * lookup with a generic file as the fallback.
 */
const FILE_ICONS: Record<string, typeof FileIcon> = {
  folder: FolderIcon,
  archive: FileArchiveIcon,
  image: ImageIcon,
  audio: MusicIcon,
  video: VideoIcon,
  text: FileTextIcon,
  document: FileTextIcon,
  pdf: FileTextIcon,
  docx: FileTypeIcon,
  pptx: PresentationIcon,
  xlsx: FileSpreadsheetIcon,
  spreadsheet: FileSpreadsheetIcon,
  code: FileCodeIcon,
  binary: BinaryIcon,
  mirrorfile: DiscIcon,
  encryption: LockIcon,
  font: TypeIcon,
};

type SortKey = 'name' | 'size' | 'modified';

/** Client-side sort of one list; the backend order stands until a column is clicked. */
function sortEntries(items: FileEntry[], sort: { key: SortKey; dir: 'asc' | 'desc' } | null): FileEntry[] {
  if (sort === null) return items;
  const factor = sort.dir === 'asc' ? 1 : -1;
  const weight = (file: FileEntry): string | number => {
    if (sort.key === 'name') return file.name;
    if (sort.key === 'size') return file.size;
    return Date.parse(file.modified ?? '') || 0;
  };
  return [...items].sort((a, b) => {
    // A row with no stamp at all keeps the bottom of the table either way.
    const missing = sort.key === 'modified' ? Number(a.modified === null) - Number(b.modified === null) : 0;
    if (missing !== 0) return missing;
    const left = weight(a);
    const right = weight(b);
    if (typeof left === 'string' || typeof right === 'string') {
      return factor * String(left).localeCompare(String(right));
    }
    return factor * (left - right);
  });
}

/** aria2 connection the visitor configured; the one piece of panel state that outlives a page. */
const ARIA2_CONFIG_KEY = 'aiya_aria2_config';

/** Cross-instance sync: flipping the switch in any panel updates them all. */
const ARIA2_SYNC_EVENT = 'aiya:aria2-config';

const ARIA2_PRESETS: Array<{ name: string; url: string }> = [
  { name: 'Aria2Core', url: 'http://localhost:6800/jsonrpc' },
  { name: 'MotrixNext', url: 'http://localhost:16800/jsonrpc' },
  { name: 'Motrix', url: 'http://localhost:16800/jsonrpc' },
];

interface Aria2Config {
  /** When on, every row's action button becomes a push into the RPC. */
  enabled: boolean;
  rpcUrl: string;
  token: string;
}

/** Why a claim did not answer a link; the row shows one line per kind. */
type ClaimFailure = 'login' | 'limited' | 'credits' | 'failed';

/** Classify a refused claim; the proxy hands the backend's `aiya_*` code through. */
function claimFailure(status: number, payload: { code?: string | null } | null): ClaimFailure {
  if (status === 401) return 'login';
  if (status === 429) return 'limited';
  if (payload?.code === 'aiya_credit_insufficient') return 'credits';
  return 'failed';
}

function readAria2Config(): Aria2Config {
  const fallback: Aria2Config = { enabled: false, rpcUrl: ARIA2_PRESETS[0].url, token: '' };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(ARIA2_CONFIG_KEY);
    if (raw === null) return fallback;
    const stored = JSON.parse(raw) as Partial<Aria2Config>;
    return {
      enabled: stored.enabled === true,
      rpcUrl: typeof stored.rpcUrl === 'string' && stored.rpcUrl !== '' ? stored.rpcUrl : fallback.rpcUrl,
      token: typeof stored.token === 'string' ? stored.token : '',
    };
  } catch {
    return fallback;
  }
}

/**
 * The one delivery path every claimed link goes through. File-service links
 * (OpenList /d/, gofile) answer with a download payload, so they load in a
 * detached iframe — the reader's page never navigates and no popup is
 * involved. Pan links are pages a person reads, so they alone open a tab.
 */
function deliverFile(url: string, external: boolean): void {
  if (external) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  frame.src = url;
  frame.addEventListener('load', () => {
    // Keep the frame alive through long transfers; a removed frame aborts
    // the download it is carrying.
    window.setTimeout(() => frame.remove(), 120_000);
  });
  document.body.appendChild(frame);
}

/**
 * Hand one link to the visitor's own aria2 RPC. The browser calls localhost
 * directly, so the client must accept cross-origin posts
 * (`aria2c --rpc-allow-origin-all`) — a requirement the legacy panel shared.
 */
async function aria2Add(config: Aria2Config, url: string, filename: string): Promise<boolean> {
  const params: unknown[] = [];
  if (config.token !== '') params.push(`token:${config.token}`);
  params.push([url]);
  params.push({ out: filename });
  try {
    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'aria2.addUri',
        id: `aiya-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        params,
      }),
    });
    if (!response.ok) return false;
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    return payload !== null && payload.error === undefined;
  } catch {
    return false;
  }
}

/**
 * File download panel: one block per data group, each with its own caption and
 * rate. Rows are names and metadata only — the link is not in the list at all,
 * so every row leads through the claim call, which prices it, charges the
 * ledger and answers the link (and the drive's extraction code beside it).
 *
 * The table (type icons, size / modified columns, sorting, multi-select) and
 * the aria2 push are front-end comfort on top of that one call: a push claims
 * the row first, which is why a priced list costs its rate per pushed file,
 * and the batch button states that total before anything is sent.
 */
export function DownloadPanel({
  lists,
  postId,
  loggedIn,
  locale,
}: {
  lists: FileList[];
  postId: number;
  loggedIn: boolean;
  locale: Locale;
}) {
  const copy = t(locale).resources;
  const [claims, setClaims] = useState<Record<string, { url: string; code: string | null }>>({});
  const [failures, setFailures] = useState<Record<string, ClaimFailure>>({});
  const [pending, setPending] = useState<string>('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [aria2, setAria2State] = useState<Aria2Config>(readAria2Config);

  // The push switch is a site-wide preference: every write goes through the
  // storage + a sync event, so every mounted panel on the site flips with it
  // instead of each instance keeping its own toggle.
  const setAria2 = useCallback((updater: (prev: Aria2Config) => Aria2Config) => {
    setAria2State((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(ARIA2_CONFIG_KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked — the push still works for this visit */
      }
      window.dispatchEvent(new CustomEvent<Aria2Config>(ARIA2_SYNC_EVENT, { detail: next }));
      return next;
    });
  }, []);

  useEffect(() => {
    const sync = (event: Event): void => {
      const config = (event as CustomEvent<Aria2Config>).detail;
      if (config && typeof config === 'object') setAria2State(config);
    };
    window.addEventListener(ARIA2_SYNC_EVENT, sync);
    return () => window.removeEventListener(ARIA2_SYNC_EVENT, sync);
  }, []);

  /**
   * Resolve one row to its link, caching it per row: repeat clicks (and the
   * push beside them) reuse the answer instead of paying the ledger again.
   */
  const claim = useCallback(
    async (listId: string, ref: string): Promise<string | null> => {
      const key = `${listId}:${ref}`;
      const cached = claims[key];
      if (cached !== undefined) return cached.url;
      try {
        const response = await fetch(`/api/content/${postId}/downloads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId, ref }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          url?: string;
          code?: string | null;
        } | null;
        if (!response.ok || !payload?.ok || !payload.url) {
          setFailures((prev) => ({ ...prev, [key]: claimFailure(response.status, payload) }));
          return null;
        }
        setFailures((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setClaims((prev) => ({ ...prev, [key]: { url: payload.url as string, code: payload.code ?? null } }));
        return payload.url;
      } catch {
        setFailures((prev) => ({ ...prev, [key]: 'failed' }));
        return null;
      }
    },
    [claims, postId],
  );

  const download = async (list: FileList, ref: string): Promise<void> => {
    const key = `${list.id}:${ref}`;
    setPending(key);
    try {
      const url = await claim(list.id, ref);
      if (url === null) return;
      // Pan links are pages (the drive's own UI), so they alone navigate;
      // everything else downloads through a detached iframe.
      deliverFile(url, list.adapter === 'platform');
    } finally {
      setPending('');
    }
  };

  const pushRow = async (listId: string, ref: string, name: string): Promise<void> => {
    const key = `${listId}:${ref}`;
    setPending(key);
    try {
      const url = await claim(listId, ref);
      if (url === null) {
        toast.error(copy.pushUnavailable);
        return;
      }
      if (await aria2Add(aria2, url, name)) toast.success(copy.pushDone(1));
      else toast.error(copy.pushFailed(1));
    } finally {
      setPending('');
    }
  };

  const pushSelected = async (list: FileList): Promise<void> => {
    const rows = list.items.filter((file) => file.kind === 'file' && selected[`${list.id}:${file.ref}`] === true);
    if (rows.length === 0) return;
    setPending(`batch:${list.id}`);
    let sent = 0;
    let failed = 0;
    // One row at a time: every claim is a priced call and the route is rate
    // limited, so a burst would only turn into 429s.
    for (const file of rows) {
      const url = await claim(list.id, file.ref);
      if (url === null || !(await aria2Add(aria2, url, file.name))) failed += 1;
      else sent += 1;
    }
    setPending('');
    setSelected((prev) => {
      const next = { ...prev };
      for (const file of rows) delete next[`${list.id}:${file.ref}`];
      return next;
    });
    if (sent > 0) toast.success(copy.pushDone(sent));
    if (failed > 0) toast.error(copy.pushFailed(failed));
  };

  const toggleSort = (key: SortKey): void =>
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const toggleSelected = (key: string): void =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key] === true) delete next[key];
      else next[key] = true;
      return next;
    });

  const toggleAll = (list: FileList, files: FileEntry[]): void =>
    setSelected((prev) => {
      const next = { ...prev };
      const every = files.every((file) => next[`${list.id}:${file.ref}`] === true);
      for (const file of files) {
        const key = `${list.id}:${file.ref}`;
        if (every) delete next[key];
        else next[key] = true;
      }
      return next;
    });

  const sortHead = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="flex items-center gap-1 whitespace-nowrap hover:text-foreground"
    >
      {label}
      {sort?.key === key ? (
        sort.dir === 'asc' ? (
          <ArrowUpIcon className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDownIcon className="size-3" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDownIcon className="size-3 opacity-50" aria-hidden="true" />
      )}
    </button>
  );

  const hasRows = lists.some((list) => list.items.length > 0);

  /** The push settings bubble: trigger reads "推送到下载器", the switch
   * lives inside. Rendered only on file-service groups — pan groups always
   * navigate and never push. */
  const aria2Settings = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            aria2.enabled
              ? 'border-primary/60 bg-primary/5 text-foreground'
              : 'border-border text-body-muted hover:text-foreground'
          }`}
        >
          <SettingsIcon className="size-3.5" aria-hidden="true" />
          {copy.pushToClient}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-body-muted">{copy.configureClientHint}</p>
          <label className="flex items-center justify-between gap-2">
            <span className="text-sm text-foreground">{copy.pushToClient}</span>
            <Switch
              checked={aria2.enabled}
              onCheckedChange={(checked) => setAria2((prev) => ({ ...prev, enabled: checked === true }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-body-muted">{copy.preset}</span>
            <select
              value={ARIA2_PRESETS.find((preset) => preset.url === aria2.rpcUrl)?.url ?? ''}
              onChange={(event) => {
                const preset = ARIA2_PRESETS.find((candidate) => candidate.url === event.target.value);
                if (preset) setAria2((prev) => ({ ...prev, rpcUrl: preset.url }));
              }}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
            >
              <option value="">{copy.presetPlaceholder}</option>
              {ARIA2_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.url}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-body-muted">{copy.rpcUrl}</span>
            <Input
              value={aria2.rpcUrl}
              onChange={(event) => setAria2((prev) => ({ ...prev, rpcUrl: event.target.value }))}
              className="h-8"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-body-muted">{copy.secret}</span>
            <Input
              type="password"
              value={aria2.token}
              onChange={(event) => setAria2((prev) => ({ ...prev, token: event.target.value }))}
              className="h-8"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex flex-col gap-5">
      {!hasRows && (
        <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted">
          {copy.downloadsEmpty}
        </p>
      )}
      {lists.map((list) => {
        const items = sortEntries(list.items, sort);
        const files = list.items.filter((file) => file.kind === 'file');
        const chosen = files.filter((file) => selected[`${list.id}:${file.ref}`] === true);
        const allChosen = files.length > 0 && chosen.length === files.length;
        // Pan groups (share links) only ever navigate: no push button, no
        // batch push, no push settings — the sub-component tree is skipped
        // for them entirely.
        const pushable = list.adapter !== 'platform';
        const pushOn = pushable && aria2.enabled;
        return (
          <section key={list.id} className="flex flex-col gap-2">
            {/* One line: the group's own caption left, the push settings and
                the batch push right. This line IS the heading — the panel
                carries no title of its own. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-base font-semibold text-foreground">
                {list.title !== '' ? list.title : copy.downloads}
              </h5>
              <div className="flex items-center gap-3">
                {pushable && chosen.length > 0 && (
                  <button
                    type="button"
                    disabled={pending === `batch:${list.id}`}
                    onClick={() => void pushSelected(list)}
                    className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {pending === `batch:${list.id}` ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <SendIcon className="size-3.5" aria-hidden="true" />
                    )}
                    {chosen.length * list.price > 0
                      ? copy.pushSelectedWithCredits(chosen.length * list.price)
                      : copy.pushSelected}
                  </button>
                )}
                {loggedIn && pushable && files.length > 0 && aria2Settings}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-body-muted">
                    <th className="w-10 px-3 py-2">
                      {loggedIn && files.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allChosen}
                          onChange={() => toggleAll(list, files)}
                          aria-label={copy.selectAll}
                        />
                      )}
                    </th>
                    <th className="px-3 py-2">{sortHead('name', copy.thName)}</th>
                    <th className="w-24 px-3 py-2 text-right">{sortHead('size', copy.thSize)}</th>
                    <th className="w-20 whitespace-nowrap px-3 py-2 text-right">{copy.thCredits}</th>
                    <th className="w-28 px-3 py-2">{sortHead('modified', copy.thModified)}</th>
                    <th className="w-56 px-3 py-2">{copy.thActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((file) => {
                    const key = `${list.id}:${file.ref}`;
                    const Icon = FILE_ICONS[file.type] ?? FileIcon;
                    const size = file.kind === 'dir' ? null : fileSizeText(file.size);
                    const claimed = claims[key];
                    const failure = failures[key];
                    return (
                      <tr key={key}>
                        <td className="px-3 py-2.5 align-middle">
                          {loggedIn && file.kind === 'file' && (
                            <input
                              type="checkbox"
                              checked={selected[key] === true}
                              onChange={() => toggleSelected(key)}
                              aria-label={file.name}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon className="size-4 flex-none text-body-muted" aria-hidden="true" />
                            <span className="truncate text-foreground">{file.name}</span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle text-xs text-body-muted">
                          {size !== null ? size : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-middle text-xs text-body-muted">
                          {list.price > 0 ? list.price : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-body-muted">
                          {file.modified !== null ? displayDate(file.modified, locale) : '—'}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          {file.kind === 'dir' ? (
                            <span className="text-xs text-body-muted">—</span>
                          ) : !loggedIn ? (
                            <span className="text-xs text-body-muted">{copy.loginToDownload}</span>
                          ) : (
                            <span className="flex flex-col items-start gap-1">
                              <span className="flex items-center gap-2 whitespace-nowrap">
                                {claimed !== undefined && claimed.code !== null && (
                                  <span className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-body-muted">
                                    {copy.extractionCode} {claimed.code}
                                  </span>
                                )}
                                {/* One button, two modes on file-service
                                    groups: the site-wide push switch turns
                                    download into push. Pan groups always
                                    navigate; their price lives in its column. */}
                                <button
                                  type="button"
                                  disabled={pending === key}
                                  title={pushOn ? copy.pushToClient : undefined}
                                  onClick={() =>
                                    void (pushOn
                                      ? pushRow(list.id, file.ref, file.name)
                                      : download(list, file.ref))
                                  }
                                  className="flex items-center gap-1.5 whitespace-nowrap rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                                >
                                  {pending === key ? (
                                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
                                  ) : pushOn ? (
                                    <SendIcon className="size-3.5" aria-hidden="true" />
                                  ) : (
                                    <DownloadIcon className="size-3.5" aria-hidden="true" />
                                  )}
                                  {pushOn ? copy.push : copy.download}
                                </button>
                              </span>
                              {failure !== undefined && (
                                <span className={`text-xs ${failure === 'login' ? 'text-body-muted' : 'text-destructive'}`}>
                                  {failure === 'login'
                                    ? copy.loginToDownload
                                    : failure === 'limited'
                                      ? t(locale).errors.aiya_rate_limited
                                      : failure === 'credits'
                                        ? copy.creditsShort
                                        : copy.downloadFailed}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Heading plus panel, shared by the three detail shells. A null list means the
 * read failed (or the post is gated) and the section stays away entirely.
 */
/**
 * The download block as an in-card module: it rides inside the article
 * card, under the body, and carries no section heading of its own — each
 * data group's own caption (with the aria2 controls beside it) is the
 * heading. A null list means the read failed (or the post is gated) and
 * the block stays away entirely.
 */
export function DownloadSection({
  lists,
  postId,
  loggedIn,
  locale,
}: {
  lists: FileList[] | null;
  postId: number;
  loggedIn: boolean;
  locale: Locale;
}) {
  if (lists === null || lists.length === 0) return null;
  return (
    <div className="mt-8 border-t border-dashed border-border pt-6">
      <DownloadPanel lists={lists} postId={postId} loggedIn={loggedIn} locale={locale} />
    </div>
  );
}

/** Shared section heading for sidebar panels. */
export function SidebarHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-body-muted">
      {children}
    </h2>
  );
}

/**
 * The comment block shared by all three shells: a gated/locked body hides
 * its comments too (WP 404s reads behind the lock — the loader already
 * skipped the fetch for those states).
 */
export function CommentsBlock({
  post,
  comments,
  commentsPagination,
  settings,
  loggedIn,
  locale,
  window,
}: {
  post: PostDetail;
  comments: Comment[];
  commentsPagination: { page: number; totalPages: number; hasNext: boolean };
  settings: SiteComments;
  loggedIn: boolean;
  locale: Locale;
  window: { order: 'asc' | 'desc'; perPage: number };
}) {
  if (post.gated || post.locked) return null;
  return (
    <CommentSection
      postId={post.id}
      initial={comments}
      pagination={commentsPagination}
      total={post.metrics.comments}
      order={window.order}
      perPage={window.perPage}
      settings={settings}
      loggedIn={loggedIn}
      closed={!post.commentsOpen}
      locale={locale}
    />
  );
}

/** One anonymous view ping per detail mount; dedup is the backend's job. */
export function useViewPing(postId: number): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void fetch(`/api/content/${postId}/view/`, { method: 'POST', keepalive: true }).catch(
      () => {},
    );
  }, [postId]);
}
