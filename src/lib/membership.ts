import type { MembershipEntitlement, Tier } from '@/lib/core/contracts';
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

/**
 * The queue row whose paid window covers `now` — the single definition of
 * "currently effective tier" shared by the shell (SSR badge/button label) and
 * the wallet bubble (client fetch). Contract timestamps are ISO with an
 * offset, so compare parsed instants: lexicographic string comparison would
 * mis-order values written with different offsets.
 */
export function activeMembershipTier(
  membership: { queue: readonly MembershipEntitlement[] } | null | undefined,
  now = Date.now(),
): MembershipEntitlement | null {
  return (
    membership?.queue.find((row) => {
      if (row.status !== 'active') return false;
      return Date.parse(row.startsAt) <= now && now < Date.parse(row.endsAt);
    }) ?? null
  );
}

/**
 * Payment methods the cashier can offer for one plan, in the contract's own
 * order. A plan sells through the cashier only when the gateway is live AND
 * the plan itself names that channel — an Afdian plan has no submit URL here,
 * so it returns no methods at all and its card never draws a cashier button.
 */
export function paymentMethods(
  channels: {
    epay: boolean;
    methods: readonly ('alipay' | 'wxpay' | 'usdt')[];
  },
  tier: Pick<Tier, 'channels'>,
): ('alipay' | 'wxpay' | 'usdt')[] {
  return channels.epay && tier.channels.includes('epay') ? [...channels.methods] : [];
}

/** Whether the plan is sold on the Afdian platform (its own button, no price here). */
export function sellsOnAfdian(
  channels: { afdian: boolean },
  tier: Pick<Tier, 'channels'>,
): boolean {
  return channels.afdian && tier.channels.includes('afdian');
}

/** Whether the card shows a price at all: only the cashier's own plans are priced here. */
export function showsPrice(tier: Pick<Tier, 'channels'>): boolean {
  return tier.channels.includes('epay');
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
