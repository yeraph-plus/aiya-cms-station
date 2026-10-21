import { cn } from '@/lib/utils';
import { Kicker } from './bits';
import type { EditorialImage } from './types';

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue';

/**
 * avision's article cover (centred 440px block over a parallax photo) and the
 * byline panel that brackets the body. The parallax is deliberately dropped:
 * it is a scroll-jank source on touch and a motion-sensitivity problem; the
 * cover gradient is the shared `.hero-scrim` recipe, and the body keeps the
 * site's article rhythm (lib/prose.ts) instead of avision's 16/1.875 copy
 * column.
 */

export function ArticleHero({
  title,
  kicker,
  kickerHref,
  image,
  headingLevel = 'h1',
  className,
}: {
  title: string;
  kicker?: string | null;
  kickerHref?: string | null;
  image?: EditorialImage | null;
  /** A real post page owns the only h1; a reference/preview page demotes it. */
  headingLevel?: 'h1' | 'h2';
  className?: string;
}) {
  const Heading = headingLevel;
  return (
    <header className={cn('relative isolate overflow-hidden bg-ed-shell text-white', className)}>
      {image && (
        <img
          src={image.url}
          alt={image.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          loading="eager"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="hero-scrim absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-shell flex-col items-center px-6 pb-24 pt-32 text-center lg:pb-32 lg:pt-44">
        <div className="max-w-lg">
          {kicker && (
            <Kicker onMedia href={kickerHref ?? undefined}>
              {kicker}
            </Kicker>
          )}
          <Heading className="mt-5 text-display-sm font-semibold leading-tight text-white">
            {title}
          </Heading>
        </div>
      </div>
    </header>
  );
}

export interface ShareTarget {
  label: string;
  href: string;
}

export function BylinePanel({
  author,
  authorHref,
  avatar,
  date,
  note,
  shareLabel,
  share = [],
  className,
}: {
  author?: string | null;
  authorHref?: string | null;
  avatar?: EditorialImage | null;
  date?: string | null;
  note?: string | null;
  shareLabel?: string;
  share?: ShareTarget[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-4', className)}>
      {avatar && (
        <img
          src={avatar.url}
          alt=""
          width={avatar.width ?? 58}
          height={avatar.height ?? 58}
          loading="lazy"
          decoding="async"
          className="size-14 shrink-0 rounded-full border-[5px] border-card bg-ed-tile object-cover"
        />
      )}
      <div className="min-w-0">
        {author &&
          (authorHref ? (
            <a
              href={authorHref}
              className={cn(
                'text-sm font-medium text-foreground transition-colors duration-fast hover:text-muted-foreground',
                FOCUS,
              )}
            >
              {author}
            </a>
          ) : (
            <span className="text-sm font-medium text-foreground">{author}</span>
          ))}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {date && <span>{date}</span>}
          {date && note && <span aria-hidden="true">·</span>}
          {note && <span>{note}</span>}
        </p>
      </div>
      {share.length > 0 && (
        <div className="ms-auto flex items-center gap-4">
          {shareLabel && (
            <span className="text-label font-bold uppercase tracking-brand text-muted-foreground/70">
              {shareLabel}
            </span>
          )}
          <ul className="flex items-center gap-3">
            {share.map((target) => (
              <li key={target.href + target.label}>
                <a
                  href={target.href}
                  rel="noopener noreferrer"
                  className={cn(
                    'text-xs font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground',
                    FOCUS,
                  )}
                >
                  {target.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
