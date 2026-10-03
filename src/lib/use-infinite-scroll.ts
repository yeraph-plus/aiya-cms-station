import { useCallback, useEffect, useRef, type RefObject } from 'react';

export interface InfiniteScroll {
  /** The sentinel div to render below the list. */
  sentinelRef: RefObject<HTMLDivElement | null>;
  /** Call from the append's `finally`: `ok` drives the backoff ladder — a
      successful page re-checks the sentinel almost immediately (short pages
      keep filling to their end marker), a failed one backs off exponentially
      (capped) so a dead endpoint is not hammered at poll cadence. */
  rearm: (ok: boolean) => void;
}

/**
 * Auto-append driver shared by the feed islands. An IntersectionObserver
 * only fires on intersection CHANGES, so it is paired with a slow poll (and
 * a passive scroll listener): a short page that leaves the sentinel inside
 * the 600px early-load margin, or a backgrounded tab that never produces
 * observer callbacks, keeps calling `start` regardless. The caller owns the
 * fetch itself — single-flight, queue, sequence guards — and `start`
 * early-returns whenever an append must not run. The re-arm timeout outlives
 * the append that scheduled it; unmount cancels it, or it would fire one
 * append (and a setState) into a dead island.
 */
export function useInfiniteScroll(options: {
  /** Observe only while true (e.g. the loop's autoLoad). */
  enabled: boolean;
  /** Attempt one append; must no-op when one is already in flight. */
  start: () => void;
}): InfiniteScroll {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Latest-options mirror: the callbacks below are stable, the callers'
  // start closures are not — dereference at fire time, never capture.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const failuresRef = useRef(0);
  const rearmRef = useRef<number | null>(null);

  useEffect(() => {
    if (!options.enabled) return;
    const el = sentinelRef.current;
    if (!el) return;
    const near = () => el.getBoundingClientRect().top < window.innerHeight + 600;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) optionsRef.current.start();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    // Fallback poll: backgrounded tabs may never produce observer callbacks.
    const poll = window.setInterval(() => {
      if (near()) optionsRef.current.start();
    }, 600);
    const onScroll = () => {
      if (near()) optionsRef.current.start();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.clearInterval(poll);
      window.removeEventListener('scroll', onScroll);
      if (rearmRef.current !== null) window.clearTimeout(rearmRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  const rearm = useCallback((ok: boolean) => {
    failuresRef.current = ok ? 0 : failuresRef.current + 1;
    const delay = ok ? 200 : Math.min(200 * 2 ** failuresRef.current, 10_000);
    rearmRef.current = window.setTimeout(() => {
      const el = sentinelRef.current;
      if (el && el.getBoundingClientRect().top < window.innerHeight + 600) {
        optionsRef.current.start();
      }
    }, delay);
  }, []);

  return { sentinelRef, rearm };
}
