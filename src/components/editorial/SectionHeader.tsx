import { ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue';

export interface SectionTag {
  label: string;
  href: string;
  active?: boolean;
}

export interface SectionMoreItem {
  label: string;
  href: string;
}

export interface SectionHeaderProps {
  title: string;
  /** `id` for the heading, so a section can own `aria-labelledby`. */
  id?: string;
  tags?: SectionTag[];
  /** Direct archive link ("more") or a disclosure of further terms. */
  more?: { label: string; href?: string; items?: SectionMoreItem[] };
  className?: string;
}

/**
 * avision's section panel: 18px title with a 50×2px rule under its baseline,
 * pill tags to the right, and a "more" affordance at the far edge. The tag row
 * scrolls horizontally instead of hiding items at 1199/768px, and the "more"
 * menu is a native `<details>` disclosure rather than a hover-only dropdown.
 */
export function SectionHeader({ title, id, tags, more, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-x-6 gap-y-3', className)}>
      <h2 id={id} className="ed-rule relative shrink-0 pb-3 text-lg font-bold text-foreground">
        {title}
      </h2>
      {tags && tags.length > 0 && (
        <ul className="ed-scroll-x flex min-w-0 flex-1 items-center gap-1 pb-1.5">
          {tags.map((tag) => (
            <li key={tag.href + tag.label} className="shrink-0">
              <a
                href={tag.href}
                aria-current={tag.active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-7 items-center rounded-full px-5 text-label font-medium uppercase tracking-kicker transition-colors duration-fast',
                  FOCUS,
                  tag.active
                    ? 'bg-card text-foreground'
                    : 'bg-secondary text-foreground/70 hover:bg-card hover:text-foreground',
                )}
              >
                {tag.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {more &&
        (more.href ? (
          <a
            href={more.href}
            className={cn(
              'ml-auto inline-flex items-center gap-2 pb-2 text-label font-medium uppercase tracking-kicker text-foreground/70 transition-colors duration-fast hover:text-foreground',
              FOCUS,
            )}
          >
            {more.label}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </a>
        ) : (
          <details className="relative ml-auto">
            <summary
              className={cn(
                'ed-summary inline-flex items-center gap-2 pb-2 text-label font-medium uppercase tracking-kicker text-foreground/70 transition-colors duration-fast hover:text-foreground',
                FOCUS,
              )}
            >
              {more.label}
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </summary>
            <div className="absolute end-0 top-full z-20 mt-2 min-w-44 rounded-lg border border-border bg-popover p-2 shadow-sm">
              <ul className="flex flex-col">
                {more.items?.map((item) => (
                  <li key={item.href + item.label}>
                    <a
                      href={item.href}
                      className={cn(
                        'block rounded-md px-3 py-2 text-label font-medium uppercase tracking-kicker text-foreground/70 transition-colors duration-fast hover:bg-secondary hover:text-foreground',
                        FOCUS,
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
    </div>
  );
}
