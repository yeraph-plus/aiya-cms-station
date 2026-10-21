import { cn } from '@/lib/utils';
import type { EditorialImage } from './types';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export interface PromoCardProps {
  href: string;
  title: string;
  image?: EditorialImage | null;
  /** The phosphor line above the title (avision's "-15%"). */
  eyebrow?: string | null;
  /** `tall` = the 340px rail ad; `banner` = the 140px centred strip. */
  size?: 'tall' | 'banner';
  className?: string;
}

/**
 * The two advertising tiles from the rail (docs/EDITORIAL.md §3.4). It is a
 * presentation component: the AdSpace island owns slot rotation and the
 * `ad` / sponsored labelling; this only draws the geometry.
 */
export function PromoCard({
  href,
  title,
  image,
  eyebrow,
  size = 'tall',
  className,
}: PromoCardProps) {
  const tall = size === 'tall';
  return (
    <a
      href={href}
      className={cn(
        'group relative flex overflow-hidden rounded-md bg-ed-shell transition-colors duration-fast',
        tall
          ? 'h-[21.25rem] flex-col justify-end p-7'
          : 'h-[8.75rem] items-center justify-center p-6',
        FOCUS,
        className,
      )}
    >
      {image && (
        <img
          src={image.url}
          alt={image.alt}
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-slow group-hover:scale-105"
        />
      )}
      <div className="hero-scrim absolute inset-0" aria-hidden="true" />
      <div className={cn('relative flex flex-col gap-3', tall ? 'items-start' : 'items-center')}>
        {eyebrow && (
          <span className="text-label font-bold uppercase tracking-brand text-ed-accent">
            {eyebrow}
          </span>
        )}
        <span
          className={cn(
            'text-white',
            tall ? 'text-display-sm font-semibold leading-tight' : 'text-xl font-normal',
          )}
        >
          {title}
        </span>
      </div>
    </a>
  );
}
