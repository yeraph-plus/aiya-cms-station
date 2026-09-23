import { toBcp47, type Locale } from '@/lib/i18n/locale';

/**
 * The site's own calendar default (fallbackSite + the current WP install
 * agree). Dates are rendered in the SITE's timezone — a visitor-local clock
 * would disagree with the backend's date math (see lib/membership.ts).
 * Callers that hold /site pass `site.timezone`; the constant only keeps the
 * signature honest for callers that do not have the payload at hand.
 */
export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/** Pure formatting: safe to import from SSR components or hydrated islands. */
export function displayDate(
  value: string,
  locale: Locale = 'zh_CN',
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(toBcp47(locale), {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
