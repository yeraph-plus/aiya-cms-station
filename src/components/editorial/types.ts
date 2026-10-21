/**
 * Shared shapes for the editorial skin (docs/EDITORIAL.md §3). Everything is
 * pre-localized and pre-formatted upstream: this layer is presentation only and
 * never formats dates, pluralizes counters or resolves routes.
 */

export interface EditorialImage {
  /** Already proxied by the Astro side (`rewriteMediaUrl`). */
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

/** Card geometry, named after avision's six card families. */
export type StoryCardVariant = 'lead' | 'portrait' | 'cover' | 'text' | 'row' | 'row-round';

export interface EditorialStory {
  /** Stable key for lists; falls back to `href`. */
  id?: string;
  href: string;
  title: string;
  excerpt?: string | null;
  image?: EditorialImage | null;
  /** Category pill text (the term archive link is optional). */
  category?: string | null;
  categoryHref?: string | null;
  author?: string | null;
  authorHref?: string | null;
  /** Preformatted date/time, e.g. "Sep 29, 2017 at 9:48 am" / "2026/10/21". */
  date?: string | null;
  /** Trailing meta (views, reading time) rendered after the date. */
  note?: string | null;
  variant?: StoryCardVariant;
}
