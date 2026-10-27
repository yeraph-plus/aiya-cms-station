import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MetaLine } from './bits';
import { StoryCard } from './StoryCard';
import type { EditorialStory } from './types';

/**
 * The grey sidebar rail (avision's 375px `sidebar_background` column) and its
 * three row recipes: stories with a 70px square thumb, newest videos with a
 * circular one, and events with the ghost date block.
 */

export function Rail({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <aside
      aria-label={label}
      className={cn('flex flex-col gap-12 bg-ed-rail px-6 py-8 lg:px-8 lg:py-10', className)}
    >
      {children}
    </aside>
  );
}

export interface RailSectionAction {
  label: string;
  href?: string;
}

export function RailSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Plain data, not a node: an Astro page cannot hand a React component an
      Astro-rendered element (it arrives as a render-template object and React
      refuses to render it — the whole SSR stream dies mid-page). */
  action?: RailSectionAction;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-tight text-foreground">{title}</h2>
        {action &&
          (action.href ? (
            <a
              href={action.href}
              className="text-label uppercase tracking-kicker text-foreground/70 transition-colors duration-fast hover:text-foreground"
            >
              {action.label}
            </a>
          ) : (
            <span className="text-label uppercase tracking-kicker text-foreground/70">
              {action.label}
            </span>
          ))}
      </div>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function RailItem({
  story,
  round = false,
}: {
  story: EditorialStory;
  /** Newest-videos rail: circular thumbnail instead of the 6px square. */
  round?: boolean;
}) {
  return <StoryCard story={{ ...story, variant: round ? 'row-round' : 'row' }} />;
}

export interface EventItemProps {
  href: string;
  title: string;
  /** Preformatted day number, e.g. "13". */
  day: string;
  /** Preformatted month label, e.g. "APR". */
  month: string;
  author?: string | null;
  date?: string | null;
}

export function EventItem({ href, title, day, month, author, date }: EventItemProps) {
  return (
    <a
      href={href}
      className="group flex items-center gap-4 rounded-md transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue"
    >
      {/* Ghost date watermark: the same date reaches assistive tech through the
          byline below, so the 20%-opacity numerals are decorative. */}
      <span
        aria-hidden="true"
        className="flex size-[4.375rem] shrink-0 flex-col items-center justify-center text-ed-ghost"
      >
        <span className="text-numeral font-extrabold tabular-nums">{day}</span>
        <span className="mt-2 text-lg font-black uppercase leading-none">{month}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors duration-fast group-hover:text-primary">
          {title}
        </span>
        <MetaLine author={author} date={date} className="mt-1.5" />
      </span>
    </a>
  );
}
