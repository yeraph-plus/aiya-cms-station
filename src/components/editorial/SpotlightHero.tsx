import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLink, Kicker } from './bits';
import type { EditorialImage, EditorialStory } from './types';

/**
 * The full-bleed cover carousel (avision's home slider), rebuilt without Owl
 * Carousel: the slides are stacked in one grid cell and crossfaded by state, so
 * there is no cloned-slide DOM, no autoplay-by-default and no jQuery. The
 * "next" tile, the dot rail and arrow keys all drive the same index; autoplay
 * is opt-in and switches itself off under `prefers-reduced-motion`.
 */

const FOCUS_MEDIA =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

const CONTROL =
  'inline-flex size-10 items-center justify-center rounded-full text-white/70 transition-colors duration-fast hover:bg-white/10 hover:text-white';

export interface SpotlightSlide {
  id?: string;
  href: string;
  title: string;
  kicker?: string | null;
  kickerHref?: string | null;
  image?: EditorialImage | null;
}

export interface SpotlightHeroProps {
  slides: SpotlightSlide[];
  /** avision's three "similar posts" tiles pinned to the hero floor. */
  quickLinks?: EditorialStory[];
  ctaLabel: string;
  labels: {
    region: string;
    slide: string;
    next: string;
    previous: string;
    goTo: string;
    nextUp: string;
  };
  /** 0 (default) keeps the cover still until the reader moves it. */
  autoPlayMs?: number;
  className?: string;
}

export function SpotlightHero({
  slides,
  quickLinks = [],
  ctaLabel,
  labels,
  autoPlayMs = 0,
  className,
}: SpotlightHeroProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  const go = useCallback(
    (next: number) => {
      if (total === 0) return;
      setIndex(((next % total) + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (autoPlayMs <= 0 || total < 2 || paused) return;
    // Browser globals live in the effect only (islands render on the server).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % total),
      autoPlayMs,
    );
    return () => window.clearInterval(timer);
  }, [autoPlayMs, paused, total]);

  if (total === 0) return null;
  const nextSlide = slides[(index + 1) % total];

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(index - 1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(index + 1);
        }
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn('relative isolate w-full overflow-hidden bg-ed-shell text-white', className)}
    >
      <div className="grid min-h-[76svh] lg:min-h-[86svh]">
        {slides.map((slide, i) => (
          <div
            key={slide.id ?? slide.href}
            className="ed-slide relative"
            data-active={i === index}
            aria-hidden={i !== index}
            inert={i !== index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${labels.slide} ${i + 1} / ${total}`}
          >
            {slide.image && (
              <img
                src={slide.image.url}
                alt=""
                width={slide.image.width ?? undefined}
                height={slide.image.height ?? undefined}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
            )}
            <div className="hero-scrim absolute inset-0" aria-hidden="true" />
            <div className="relative mx-auto flex h-full w-full max-w-shell flex-col justify-center px-6 pb-40 pt-24 sm:pb-56 lg:px-12 lg:pb-64">
              <div className="max-w-md">
                {slide.kicker && (
                  <Kicker onMedia href={slide.kickerHref ?? undefined}>
                    {slide.kicker}
                  </Kicker>
                )}
                <h2 className="mt-5 text-display-md font-semibold tracking-tight text-white">
                  <a
                    href={slide.href}
                    className={cn(
                      'transition-colors duration-fast hover:text-white/80',
                      FOCUS_MEDIA,
                    )}
                  >
                    {slide.title}
                  </a>
                </h2>
                <div className="mt-6">
                  <ArrowLink onMedia href={slide.href}>
                    {ctaLabel}
                  </ArrowLink>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto w-full max-w-shell px-6 pb-6 lg:px-12 lg:pb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            {quickLinks.length > 0 && (
              <ul className="order-2 hidden w-full max-w-md gap-3 sm:grid sm:grid-cols-2 lg:order-1 lg:max-w-xl lg:grid-cols-3">
                {quickLinks.map((story) => (
                  <li key={story.id ?? story.href}>
                    <a
                      href={story.href}
                      className={cn(
                        'flex h-16 items-center rounded-md bg-ed-tile/95 px-6 transition-colors duration-fast hover:bg-white',
                        FOCUS_MEDIA,
                      )}
                    >
                      <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                        {story.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="order-1 flex flex-col items-start gap-3 lg:order-2 lg:items-end">
              {total > 1 && (
                <nav aria-label={labels.region} className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={labels.previous}
                    onClick={() => go(index - 1)}
                    className={cn(CONTROL, FOCUS_MEDIA)}
                  >
                    <ChevronLeft aria-hidden="true" className="size-5" />
                  </button>
                  <ul className="flex items-center">
                    {slides.map((slide, i) => (
                      <li key={slide.id ?? slide.href}>
                        <button
                          type="button"
                          aria-label={`${labels.goTo} ${i + 1}`}
                          aria-current={i === index ? 'true' : undefined}
                          onClick={() => go(i)}
                          className={cn(CONTROL, FOCUS_MEDIA)}
                        >
                          <span
                            className={cn(
                              'block size-1 rounded-full transition-colors duration-fast',
                              i === index ? 'bg-white' : 'bg-white/35',
                            )}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    aria-label={labels.next}
                    onClick={() => go(index + 1)}
                    className={cn(CONTROL, FOCUS_MEDIA)}
                  >
                    <ChevronRight aria-hidden="true" className="size-5" />
                  </button>
                </nav>
              )}

              {total > 1 && nextSlide && (
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  aria-label={`${labels.nextUp}: ${nextSlide.title}`}
                  className={cn(
                    'group relative hidden h-60 w-96 overflow-hidden rounded-lg bg-ed-shell text-left lg:block',
                    FOCUS_MEDIA,
                  )}
                >
                  {nextSlide.image && (
                    <img
                      src={nextSlide.image.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-slow group-hover:scale-105"
                    />
                  )}
                  <span className="hero-scrim absolute inset-0" aria-hidden="true" />
                  <span className="relative flex h-full flex-col justify-start p-8">
                    <span className="text-label font-bold uppercase tracking-brand text-white">
                      {labels.nextUp}
                    </span>
                    <span className="mt-4 line-clamp-3 text-lg font-medium leading-snug text-white">
                      {nextSlide.title}
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
