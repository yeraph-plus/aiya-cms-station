import type { Tier } from '@/lib/core/contracts';
import { DEFAULT_TIMEZONE } from '@/lib/format';
import { toBcp47, type Locale } from '@/lib/i18n/locale';

/**
 * Membership/credits presentation logic, kept pure so it is unit-testable and
 * importable from both the SSR page and the hydrated island.
 *
 * Deliberately presentation-only. Whether a check-in is still available, or
 * whether a tier may be bought, is the backend's call: this module never
 * infers interface state, it only formats what the API returned. Gate-style
 * judgements (including "already checked in today") belong to the backend and
 * arrive as an error code.
 *
 * Dates are rendered in the *site's* timezone — the backend dates membership
 * cycles and grant expiry on the site's calendar, so a visitor-local clock
 * would disagree with the server about the same instant.
 */

const DATE_PARTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/** Only tiers the backend marked purchasable; disabled ones stay hidden. */
export function purchasableTiers(items: readonly Tier[]): Tier[] {
  return items.filter((tier) => tier.enabled);
}

/** Payment methods the cashier can offer, in the contract's own order. */
export function paymentMethods(channels: {
  epay: boolean;
  methods: readonly ('alipay' | 'wxpay' | 'usdt')[];
}): ('alipay' | 'wxpay' | 'usdt')[] {
  return channels.epay ? [...channels.methods] : [];
}

/** Bare date in the site's timezone (ledger rows read better without a clock). */
export function displayDay(value: string, locale: Locale, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(toBcp47(locale), { timeZone, ...DATE_PARTS }).format(date);
  } catch {
    // Unparseable zone (WP manual-offset configuration on a strict engine):
    // the site's default calendar zone, never the visitor's clock.
    return new Intl.DateTimeFormat(toBcp47(locale), {
      timeZone: DEFAULT_TIMEZONE,
      ...DATE_PARTS,
    }).format(date);
  }
}
