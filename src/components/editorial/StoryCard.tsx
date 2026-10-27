import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Kicker, MetaLine } from './bits';
import type { EditorialImage, EditorialStory, StoryCardVariant } from './types';

/**
 * The six avision card families (docs/EDITORIAL.md §3.2), rebuilt on the site
 * card recipe:
 *
 *   lead      card_largest_with_image     555px, 16:10 cover, 18/600 title + excerpt
 *   portrait  card_small_with_image       263px, 4:3 cover, 16/600 title
 *   cover     card_*_with_background      photo card, white bottom-anchored text
 *   text      card_default_no_image       text card, 14/500 title
 *   row       side_post                   70px thumb + 14/500 title (rail)
 *   row-round newest_videos               same, circular thumb
 *
 * Two fixes over the original (docs/EDITORIAL.md §5): the card link and the
 * byline are siblings — avision nested the author link inside nothing, but a
 * naive whole-card anchor would nest links — and every card carries a visible
 * focus ring, where avision only styled `:hover`.
 */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue';

function Cover({
  image,
  ratio,
  eager = false,
}: {
  image: EditorialImage;
  ratio: string;
  eager?: boolean;
}) {
  return (
    <div className={cn('ed-media w-full bg-ed-tile', ratio)}>
      <img
        src={image.url}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  );
}

function CardShell({
  className,
  href,
  children,
  footer,
}: {
  className?: string;
  href: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        'group h-full gap-0 overflow-hidden p-0 transition-shadow duration-fast hover:shadow-sm',
        className,
      )}
    >
      <article className="flex h-full flex-col">
        <a
          href={href}
          className={cn('block min-w-0 flex-1', FOCUS, 'focus-visible:outline-offset-0')}
        >
          {children}
        </a>
        {footer}
      </article>
    </Card>
  );
}

function Byline({ story, className }: { story: EditorialStory; className?: string }) {
  return (
    <MetaLine
      author={story.author}
      authorHref={story.authorHref}
      date={story.date}
      note={story.note}
      className={className}
    />
  );
}

export interface StoryCardProps {
  story: EditorialStory;
  /** Forces the geometry; otherwise the story's own variant or its media decides. */
  variant?: StoryCardVariant;
  /** First viewport image loads eagerly (LCP). */
  eager?: boolean;
  className?: string;
}

export function StoryCard({ story, variant, eager = false, className }: StoryCardProps) {
  const geometry = variant ?? story.variant ?? (story.image ? 'portrait' : 'text');

  if (geometry === 'lead') {
    return (
      <CardShell
        href={story.href}
        className={className}
        footer={<Byline story={story} className="mt-auto px-6 pb-5 pt-5" />}
      >
        {story.image && <Cover image={story.image} ratio="aspect-[16/10]" eager={eager} />}
        <div className="px-6 pt-4">
          <h3 className="text-lg font-semibold leading-snug text-foreground transition-colors duration-fast group-hover:text-primary">
            {story.title}
          </h3>
          {story.excerpt && (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {story.excerpt}
            </p>
          )}
        </div>
      </CardShell>
    );
  }

  if (geometry === 'cover') {
    return (
      <a
        href={story.href}
        className={cn(
          'group relative flex h-full min-h-[15rem] flex-col justify-end overflow-hidden rounded-lg bg-ed-shell transition-colors duration-fast',
          FOCUS,
          className,
        )}
      >
        {story.image && (
          <img
            src={story.image.url}
            alt={story.image.alt}
            width={story.image.width ?? undefined}
            height={story.image.height ?? undefined}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-slow group-hover:scale-105"
          />
        )}
        <div className="hero-scrim absolute inset-0" aria-hidden="true" />
        <div className="relative p-6">
          {story.category && (
            <Kicker onMedia className="mb-3">
              {story.category}
            </Kicker>
          )}
          <h3 className="text-lg font-semibold leading-snug text-white">{story.title}</h3>
          <MetaLine
            author={story.author}
            date={story.date}
            note={story.note}
            onMedia
            className="mt-4"
          />
        </div>
      </a>
    );
  }

  if (geometry === 'text') {
    return (
      <CardShell
        href={story.href}
        className={className}
        footer={
          story.author || story.date || story.note ? (
            <Byline story={story} className="mt-auto px-6 pb-5" />
          ) : null
        }
      >
        <div className="px-6 pb-4 pt-4">
          <h3 className="text-sm font-medium leading-snug text-foreground transition-colors duration-fast group-hover:text-primary">
            {story.title}
          </h3>
        </div>
      </CardShell>
    );
  }

  if (geometry === 'row' || geometry === 'row-round') {
    return (
      <a
        href={story.href}
        className={cn(
          'group flex items-center gap-4 transition-colors duration-fast',
          FOCUS,
          className,
        )}
      >
        <span
          className={cn(
            'size-[4.375rem] shrink-0 overflow-hidden bg-ed-tile',
            geometry === 'row-round' ? 'rounded-full' : 'rounded-md',
          )}
        >
          {story.image && (
            <img
              src={story.image.url}
              alt={story.image.alt}
              width={story.image.width ?? undefined}
              height={story.image.height ?? undefined}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              className="size-full object-cover transition-transform duration-slow group-hover:scale-105"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors duration-fast group-hover:text-primary">
            {story.title}
          </span>
          <MetaLine author={story.author} date={story.date} note={story.note} className="mt-1.5" />
        </span>
      </a>
    );
  }

  return (
    <CardShell
      href={story.href}
      className={className}
      footer={<Byline story={story} className="mt-auto px-6 pb-5 pt-4" />}
    >
      {story.image && <Cover image={story.image} ratio="aspect-[4/3]" eager={eager} />}
      <div className="px-6 pt-4">
        <h3 className="text-base font-semibold leading-snug text-foreground transition-colors duration-fast group-hover:text-primary">
          {story.title}
        </h3>
      </div>
    </CardShell>
  );
}
