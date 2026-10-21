import { cn } from '@/lib/utils';
import { Kicker } from './bits';
import type { EditorialImage } from './types';

/**
 * The archive/category cover band (avision's `category.html` `.home`: a plain
 * 360px image strip with no text at all). Kept verbatim as the default — pass
 * `title`/`count` when a modern archive needs to name itself. The cover text,
 * when present, sits on the shared `.hero-scrim` recipe, never a local
 * gradient.
 */
export interface ArchiveHeroProps {
  /** Archive name. Omit to reproduce avision's silent band. */
  title?: string;
  /** Term label above the title (rendered as the category pill). */
  kicker?: string;
  description?: string | null;
  /** Preformatted count, e.g. "共 32 篇". */
  count?: string | null;
  image?: EditorialImage | null;
  className?: string;
}

export function ArchiveHero({
  title,
  kicker,
  description,
  count,
  image,
  className,
}: ArchiveHeroProps) {
  const hasText = Boolean(title || description || count);
  return (
    <header
      className={cn(
        'relative isolate overflow-hidden bg-ed-shell',
        hasText ? 'min-h-[22.5rem]' : 'h-[22.5rem]',
        className,
      )}
    >
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
      {hasText && (
        <>
          <div className="hero-scrim absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[22.5rem] w-full max-w-shell flex-col items-center justify-center px-6 py-16 text-center">
            <div className="max-w-lg">
              {kicker && <Kicker onMedia>{kicker}</Kicker>}
              {title && (
                <h1 className="mt-5 text-display-sm font-semibold leading-tight text-white">
                  {title}
                </h1>
              )}
              {description && <p className="mt-4 text-sm leading-6 text-white/80">{description}</p>}
              {count && (
                <p className="mt-5 text-label uppercase tracking-brand text-white/60">{count}</p>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
