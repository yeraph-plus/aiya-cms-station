import { cn } from '@/lib/utils';

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-blue';

export interface TagItem {
  label: string;
  /** Omit for a read-only tag (no term archive behind it). */
  href?: string;
}

/**
 * avision's article tag row (`.post_tag`: 24px tall, hairline border, 3px
 * radius, 12px label, hover fills with the grey). Reused by the article footer
 * and by any chip row that is not a navigation pill.
 */
export function TagList({
  tags,
  label = '标签',
  className,
}: {
  tags: TagItem[];
  label?: string;
  className?: string;
}) {
  const chip =
    'inline-flex h-6 items-center rounded-sm border border-border px-2.5 text-label font-medium text-foreground/70 transition-colors duration-fast';
  return (
    <ul aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <li key={tag.href ?? tag.label}>
          {tag.href ? (
            <a
              href={tag.href}
              className={cn(
                chip,
                'hover:border-secondary hover:bg-secondary hover:text-foreground',
                FOCUS,
              )}
            >
              {tag.label}
            </a>
          ) : (
            <span className={chip}>{tag.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
