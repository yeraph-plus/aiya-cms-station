import { cn } from '@/lib/utils';

/**
 * Shared avatar with the letter fallback (UX.md §3): first grapheme of the
 * name (or `?` when empty) on a secondary disc. One recipe for the whole
 * site — the seven hand-rolled copies this replaced had already drifted on
 * text color and the empty-name fallback. Sizes ride the caller's
 * className (`size-*` for the disc, `text-*` for the letter); media URLs
 * arrive pre-cloaked through rewriteMediaUrl.
 */
export default function Avatar({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  if (url) {
    return <img src={url} alt="" className={cn('rounded-full object-cover', className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full bg-secondary font-medium',
        className,
      )}
    >
      {name.slice(0, 1) || '?'}
    </span>
  );
}
