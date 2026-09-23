import { useState } from 'react';

import { AwardIcon, CoinsIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CreditEntry, MembershipState } from '@/lib/core/contracts';
import { t, type Locale } from '@/lib/i18n';
import { displayDay } from '@/lib/membership';

/**
 * The /profile/me/?tab=wallet content: membership orders (the tier queue —
 * one row per purchase) above the credit ledger with its "load more". Reads
 * ride the SSR shell, so this island only performs the ledger paging; copy
 * comes from the dictionary the island imports itself (MembershipPlans
 * convention — it cannot drift from the page's own copy).
 */
export default function WalletPanel({
  locale,
  timezone,
  membership,
  entries,
  hasMore,
}: {
  locale: Locale;
  timezone: string;
  membership: MembershipState;
  entries: CreditEntry[];
  hasMore: boolean;
}) {
  const dict = t(locale);
  const copy = dict.membership;

  const [ledger, setLedger] = useState<CreditEntry[]>(entries);
  const [more, setMore] = useState(hasMore);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const loadMore = async () => {
    setBusy(true);
    try {
      const next = page + 1;
      const response = await fetch(`/api/credits/entries/?page=${next}`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        entries?: CreditEntry[];
        pagination?: { hasNext: boolean };
      } | null;
      if (json?.ok && json.entries) {
        setLedger((current) => [...current, ...json.entries!]);
        setPage(next);
        setMore(Boolean(json.pagination?.hasNext));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-border bg-surface p-5">
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <AwardIcon className="size-4 text-primary" aria-hidden="true" />
          {copy.walletOrdersTitle}
        </h3>
        {membership.queue.length === 0 ? (
          <p className="mt-3 text-sm text-body-muted">{copy.walletOrdersEmpty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {membership.queue.map((entitlement) => (
              <li
                key={`${entitlement.tierKey}-${entitlement.startsAt}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border p-3 text-sm"
              >
                <span className="font-medium text-foreground">{entitlement.tierName}</span>
                <span className="text-xs text-body-muted">
                  {copy.queueCycles(entitlement.cyclesGranted, entitlement.cyclesTotal)}
                </span>
                <span className="text-xs text-body-muted">
                  {copy.cycleDays(entitlement.cycleDays)}
                </span>
                <span
                  className={
                    entitlement.status === 'active' ? 'text-xs text-primary' : 'text-xs text-error'
                  }
                >
                  {entitlement.status === 'active'
                    ? copy.queueStatusActive
                    : copy.queueStatusCancelled}
                </span>
                <span className="ml-auto text-xs text-body-muted">
                  {displayDay(entitlement.startsAt, locale, timezone)} —{' '}
                  {displayDay(entitlement.endsAt, locale, timezone)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <CoinsIcon className="size-4 text-primary" aria-hidden="true" />
          {copy.walletLedgerLink}
        </h3>
        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-body-muted">{copy.ledgerEmpty}</p>
        ) : (
          <>
            <ul className="mt-1 flex flex-col divide-y divide-border">
              {ledger.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-sm"
                >
                  <span className="font-medium text-foreground">{entry.source}</span>
                  <span className="text-xs text-body-muted">{entry.ref}</span>
                  <span
                    className={
                      entry.direction === 'in' ? 'text-sm text-primary' : 'text-sm text-foreground'
                    }
                  >
                    {entry.direction === 'in' ? '+' : '−'}
                    {entry.amount}
                  </span>
                  {entry.direction === 'in' && (
                    <span className="text-xs text-body-muted">
                      {copy.ledgerRemaining(entry.remaining)}
                    </span>
                  )}
                  <span className="ml-auto flex gap-2 text-xs text-body-muted">
                    <span>{displayDay(entry.createdAt, locale, timezone)}</span>
                    <span>
                      {entry.expiresAt
                        ? copy.ledgerExpires(displayDay(entry.expiresAt, locale, timezone))
                        : copy.ledgerNoExpiry}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {more && (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void loadMore()}
                >
                  {busy ? copy.ledgerLoading : copy.ledgerMore}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
