import { MegaphoneIcon } from 'lucide-react';

import type { AdSlot } from '@/lib/core/contracts';

/**
 * Advertisement space (the Blocks page's page-top / page-bottom lists):
 * fixed-height (200px) banner cards spanning the main container's width,
 * two per row — a lone card centers itself instead of hugging the left
 * column. The artwork object-covers the card from its center, so any
 * source ratio fills without distortion or gaps. Cards render plain
 * <img> banners with the slot label as alt and hover caption; external
 * targets open in a new tab with the nofollow ad rel, internal paths
 * navigate in place.
 */
export default function AdSpace({ slots }: { slots: AdSlot[] }) {
  if (slots.length === 0) return null;
  const single = slots.length === 1;

  return (
    <div
      className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
      style={{ marginBottom: '1.5rem' }}
      data-ad-space
    >
      {slots.map((slot) => {
        const external = /^https?:\/\//.test(slot.url);
        return (
          <a
            key={slot.url + slot.label}
            href={slot.url}
            {...(external ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}
            title={slot.label}
            // Geometry rides on inline styles: the dev pipeline has twice
            // served stale utility CSS for this island, and a fixed height
            // is the one property the design cannot lose.
            style={{ height: 200 }}
            className={`group relative block w-full overflow-hidden rounded-lg border border-border bg-muted/30 transition-all hover:border-primary/50 hover:shadow-sm ${
              single ? 'sm:mx-auto sm:w-[calc(50%-0.375rem)]' : ''
            }`}
          >
            <img
              src={slot.image.url}
              alt={slot.label}
              width={slot.image.width ?? undefined}
              height={slot.image.height ?? undefined}
              className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <MegaphoneIcon className="size-3" aria-hidden="true" />
              {slot.label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
