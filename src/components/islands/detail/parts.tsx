import { memo, useCallback, useEffect, useRef, useState } from 'react';

import Lightbox from 'yet-another-react-lightbox';
import { Counter, Zoom } from 'yet-another-react-lightbox/plugins';
import 'yet-another-react-lightbox/styles.css';

import {
  CalendarIcon,
  DownloadIcon,
  NewspaperIcon,
  EyeIcon,
  HeartIcon,
  MessageCircleIcon,
  StarIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
  PostDetail,
  PostSummary,
  SiteComments,
  Term,
} from '@/lib/aiya/contracts';

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
          }`}
        >
          {post.title}
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
 * its right.
 */
export function RelatedList({ related, locale }: { related: PostSummary[]; locale: Locale }) {
  const copy = t(locale);
  if (related.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 font-display text-lg font-semibold text-foreground">
        <NewspaperIcon className="size-5" aria-hidden="true" />
        {copy.posts.related}
      </h2>
      <div className="flex flex-col gap-4">
        {related.slice(0, 6).map((item) => (
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

/** OpenList attachment panel; metadata is public, links arrive per-viewer. */
export function AttachmentPanel({
  attachments,
  locale,
}: {
  attachments: { name: string; size: number; url: string | null }[];
  locale: Locale;
}) {
  const copy = t(locale).resources;
  if (attachments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted">
        {copy.attachmentsEmpty}
      </p>
    );
  }
  const sizeText = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {attachments.map((file) => (
        <li key={file.name} className="flex items-center gap-3 px-4 py-3 text-sm">
          <DownloadIcon className="size-3.5 flex-none text-body-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
          <span className="flex-none text-xs text-body-muted">{sizeText(file.size)}</span>
          {file.url ? (
            <a
              href={file.url}
              className="flex-none rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              download
            >
              {copy.download}
            </a>
          ) : (
            <span className="flex-none text-xs text-body-muted">{copy.loginToDownload}</span>
          )}
        </li>
      ))}
    </ul>
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
