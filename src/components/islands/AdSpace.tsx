import { MegaphoneIcon } from 'lucide-react';

import type { AdSlot } from '@/lib/core/contracts';
import { safeHref } from '@/lib/media';

/**
 * Advertisement space (the Blocks page's page-top / page-bottom lists):
 * banner cards spanning the main container's width, two per row — a lone
 * card centers itself instead of hugging the left column. Every upload
 * renders into ONE fixed ratio — **5:1**（站长 2026-09-25 拍板：6:1 在移动端
 * 过窄）— via object-cover: off-ratio sources crop from their center, and
 * the card's height simply scales with its width (67px on a 375px phone,
 * ~97px on the desktop two-up), which is what makes the slot mobile-safe
 * — the old fixed 200px height cropped a 375px-wide card down to a third
 * of the artwork. The ratio rides on
 * inline styles: the dev pipeline has twice served stale utility CSS for
 * this island, and the ratio is the one property the design cannot lose.
 * Cards render plain <img> banners with the slot label as alt and hover
 * caption; external targets open in a new tab with the nofollow ad rel,
 * internal paths navigate in place.
 */

/** The one render ratio every ad artwork covers into (the 1200x200 plan). */
const AD_RATIO = '5 / 1';

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
        // Last-line scheme gate: the contract already validates the target;
        // the render layer stays self-standing (null → plain banner, no link).
        const href = safeHref(slot.url);
        const external = href !== null && /^https?:\/\//.test(href);
        return (
          <a
            key={slot.url + slot.label}
            {...(href !== null ? { href } : {})}
            {...(external ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}
            title={slot.label}
            // self-start: the grid would otherwise stretch the card to the
            // row's tallest sibling. The card simply wraps its image.
            className={`group relative block w-full self-start overflow-hidden rounded-lg border border-border bg-muted/30 transition-all hover:border-primary/50 hover:shadow-sm ${
              single ? 'sm:mx-auto sm:w-[calc(50%-0.375rem)]' : ''
            }`}
          >
            <img
              src={slot.image.url}
              alt={slot.label}
              // The image owns the geometry: w-full + the fixed 5:1 ratio
              // (height derives from the card's width, so it scales across
              // viewports) and object-cover crops any off-ratio upload
              // from its center. The ratio sits on the img itself — on the
              // grid-stretched card it gets overridden by the row stretch
              // on single-column viewports. Inline style: the dev pipeline
              // has twice served stale utility CSS for this island, and
              // the ratio is the one property the design cannot lose.
              style={{ aspectRatio: AD_RATIO }}
              className="block w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-scrim-modal px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <MegaphoneIcon className="size-3" aria-hidden="true" />
              {slot.label}
            </span>
          </a>
        );
      })}
    </div>
  );
}
