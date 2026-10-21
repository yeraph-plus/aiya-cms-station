import { ArrowRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Small shared pieces of the editorial skin: the category pill, the byline
 * line, the "read on" arrow link and the pill button. They carry the whole
 * motion vocabulary (fast for colour, slow for media) so a card never invents
 * its own transition.
 */

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue';

interface KickerProps {
  children: string;
  href?: string;
  /** Sits on cover photography: translucent white pill instead of grey. */
  onMedia?: boolean;
  className?: string;
}

/** avision's 83×28 / radius-14 category pill, uppercased at label size. */
export function Kicker({ children, href, onMedia = false, className }: KickerProps) {
  const classes = cn(
    'inline-flex h-7 items-center rounded-full px-5 text-label font-medium uppercase tracking-kicker transition-colors duration-fast',
    FOCUS,
    onMedia
      ? 'bg-white/20 text-white hover:bg-white hover:text-foreground'
      : 'bg-secondary text-foreground/70 hover:bg-card hover:text-foreground',
    className,
  );
  if (!href) return <span className={classes}>{children}</span>;
  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}

interface MetaLineProps {
  author?: string | null;
  authorHref?: string | null;
  date?: string | null;
  note?: string | null;
  onMedia?: boolean;
  className?: string;
}

/** Byline: author · date · note, 12px, one bullet separator. */
export function MetaLine({
  author,
  authorHref,
  date,
  note,
  onMedia = false,
  className,
}: MetaLineProps) {
  const items = [date, note].filter((value): value is string => Boolean(value));
  if (!author && items.length === 0) return null;
  const base = onMedia ? 'text-white/70' : 'text-muted-foreground';
  const link = onMedia ? 'hover:text-white' : 'hover:text-foreground';
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', base, className)}>
      {author ? (
        authorHref ? (
          <a href={authorHref} className={cn('transition-colors duration-fast', FOCUS, link)}>
            {author}
          </a>
        ) : (
          <span>{author}</span>
        )
      ) : null}
      {items.map((item, index) => (
        <span key={item} className="flex items-center gap-2">
          {(index > 0 || author) && <span aria-hidden="true">·</span>}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

interface ArrowLinkProps extends ComponentProps<'a'> {
  /** On cover photography the link is translucent white, not grey. */
  onMedia?: boolean;
}

/** "Continue reading →": the arrow slides one step on hover/focus. */
export function ArrowLink({ onMedia = false, className, children, ...props }: ArrowLinkProps) {
  return (
    <a
      className={cn(
        'group inline-flex items-center gap-4 text-sm font-medium transition-colors duration-fast',
        FOCUS,
        onMedia ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <ArrowRight
        aria-hidden="true"
        className="size-4 shrink-0 transition-transform duration-fast group-hover:translate-x-1 group-focus-visible:translate-x-1"
      />
    </a>
  );
}

const PILL =
  'inline-flex h-9 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors duration-fast';

type PillVariant = 'outline' | 'accent' | 'solid';

const PILL_VARIANTS: Record<PillVariant, string> = {
  outline: 'border border-border text-foreground/70 hover:bg-secondary hover:text-foreground',
  accent: 'bg-ed-accent/10 text-ed-accent-strong hover:bg-ed-accent hover:text-white',
  solid: 'bg-foreground text-background hover:bg-foreground/80',
};

/** avision's "Load More" / "Post Comment" capsule. */
export function PillButton({
  variant = 'outline',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: PillVariant }) {
  return (
    <button
      type="button"
      className={cn(PILL, PILL_VARIANTS[variant], FOCUS, className)}
      {...props}
    />
  );
}

/** Link-shaped capsule (same recipe, navigation semantics). */
export function PillLink({
  variant = 'outline',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: PillVariant }) {
  return <a className={cn(PILL, PILL_VARIANTS[variant], FOCUS, className)} {...props} />;
}
