import { useEffect, useRef } from 'react';

import { ChevronUpIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Back-to-top, both shells used to render this as a vanilla button driven
 * by AppShell's delegated script — now one island per page. Visibility
 * rides the same `data-visible` attribute and `shell.css` transition as
 * before (attribute toggled straight on the DOM node: a scroll-driven
 * setState would re-render on every wheel tick). Re-mounts on ClientRouter
 * swaps re-run the effect, which re-syncs the attribute — the vanilla
 * version needed an `astro:after-swap` re-query for the same reason.
 */
export default function BackToTop({ label }: { label: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const update = () => ref.current?.toggleAttribute('data-visible', window.scrollY > 100);
    document.addEventListener('scroll', update, { passive: true });
    update();
    return () => document.removeEventListener('scroll', update);
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          data-back-to-top
          aria-label={label}
          onClick={() => {
            const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
          }}
          className="fixed right-5 bottom-24 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-md hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue min-[992px]:right-6 min-[992px]:bottom-6"
        >
          <ChevronUpIcon className="size-[18px]" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
