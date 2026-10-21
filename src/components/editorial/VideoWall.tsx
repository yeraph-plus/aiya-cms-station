import { Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { EditorialImage } from './types';

/**
 * avision's "Most Popular Videos" block: a 395px player on the left and a 263px
 * playlist column. The original mounted jquery.mb.YTPlayer on every visit (an
 * autoplaying YouTube iframe behind a black overlay); this is the facade
 * pattern — the first frame is a poster, and the embed is only injected when
 * the reader presses play. Without an `embedUrl` the play control is a link to
 * the video's own page instead.
 */

const FOCUS_MEDIA =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export interface VideoItem {
  id: string;
  title: string;
  /** Fallback destination (the entry's own page) when no embed is provided. */
  href: string;
  image?: EditorialImage | null;
  /** Preformatted "1.2M views · Sep 29". */
  meta?: string | null;
  /** Consent-free embed URL (e.g. https://www.youtube-nocookie.com/embed/…). */
  embedUrl?: string | null;
}

export interface VideoWallProps {
  items: VideoItem[];
  playLabel: string;
  className?: string;
}

export function VideoWall({ items, playLabel, className }: VideoWallProps) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = items[active];
  if (!current) return null;

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-md bg-ed-shell', className)}>
      <div className="relative aspect-video w-full overflow-hidden bg-ed-shell lg:aspect-auto lg:min-h-[24.6875rem] lg:flex-1">
        {playing && current.embedUrl ? (
          <iframe
            src={current.embedUrl}
            title={current.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <>
            {current.image && (
              <img
                src={current.image.url}
                alt={current.image.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-ed-shell/40" aria-hidden="true" />
            {current.embedUrl ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`${playLabel}: ${current.title}`}
                className={cn(
                  'absolute inset-0 flex items-center justify-center transition-colors duration-fast hover:bg-ed-shell/20',
                  FOCUS_MEDIA,
                )}
              >
                <span className="inline-flex size-20 items-center justify-center rounded-full border-2 border-ed-accent text-white transition-colors duration-fast hover:bg-ed-accent hover:text-ed-shell">
                  <Play aria-hidden="true" className="size-7 translate-x-0.5" />
                </span>
              </button>
            ) : (
              <a
                href={current.href}
                aria-label={`${playLabel}: ${current.title}`}
                className={cn(
                  'absolute inset-0 flex items-center justify-center transition-colors duration-fast hover:bg-ed-shell/20',
                  FOCUS_MEDIA,
                )}
              >
                <span className="inline-flex size-20 items-center justify-center rounded-full border-2 border-ed-accent text-white transition-colors duration-fast hover:bg-ed-accent hover:text-ed-shell">
                  <Play aria-hidden="true" className="size-7 translate-x-0.5" />
                </span>
              </a>
            )}
          </>
        )}
      </div>

      <ul className="flex w-full shrink-0 flex-col gap-4 p-6 lg:w-64">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setActive(index);
                setPlaying(false);
              }}
              aria-current={index === active ? 'true' : undefined}
              className={cn('group flex w-full items-center gap-4 text-left', FOCUS_MEDIA)}
            >
              <span className="relative size-[4.375rem] shrink-0 overflow-hidden rounded-full bg-ed-tile">
                {item.image && (
                  <img
                    src={item.image.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-slow group-hover:scale-105"
                  />
                )}
                <span
                  className={cn(
                    'absolute inset-0 transition-colors duration-fast',
                    index === active
                      ? 'bg-transparent'
                      : 'bg-ed-shell/50 group-hover:bg-transparent',
                  )}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'line-clamp-2 text-sm font-medium leading-snug transition-colors duration-fast',
                    index === active ? 'text-white' : 'text-white/60 group-hover:text-white',
                  )}
                >
                  {item.title}
                </span>
                {item.meta && (
                  <span className="mt-1.5 block text-xs text-white/50 transition-colors duration-fast group-hover:text-white/80">
                    {item.meta}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
