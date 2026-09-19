import { useState } from 'react';

import {
  AwardIcon,
  CalendarCheckIcon,
  CoinsIcon,
  LoaderCircleIcon,
  TicketIcon,
  WalletIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { CreditEntry, MembershipState, Tier } from '@/lib/aiya/contracts';
import { t, type Locale } from '@/lib/i18n';
import { displayDateTime, displayDay, paymentMethods, purchasableTiers } from '@/lib/membership';

/**
 * Copy comes from the dictionary the island imports itself — the same shape
 * `t(locale).membership` returns, so it cannot drift. Island props are JSON
 * only: handing functions across that boundary loses them silently (they are
 * present during SSR and `undefined` after hydration), which blanks the tree.
 */
export type MembershipCopy = ReturnType<typeof t>['membership'];

export interface Channels {
  epay: boolean;
  afdian: boolean;
  methods: ('alipay' | 'wxpay' | 'usdt')[];
}

interface Props {
  locale: Locale;
  timezone: string;
  channels: Channels;
  items: Tier[];
  /** Null for guests — the page renders the sign-in prompt instead. */
  membership: MembershipState | null;
  entries: CreditEntry[];
  hasMore: boolean;
}

/** Card frame shared by every block on the page. */
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function priceLabel(price: number, copy: MembershipCopy): string {
  return copy.tierPrice(Number.isInteger(price) ? String(price) : price.toFixed(2));
}

/**
 * One tier's cashier: cycles and method are local to the card, so several
 * tiers can be configured side by side without a shared form state.
 */
function TierCard({
  tier,
  channels,
  copy,
  message,
  onOrder,
}: {
  tier: Tier;
  channels: Channels;
  copy: MembershipCopy;
  /** Machine code → front-end copy (never the backend's own message). */
  message: (code?: string | null) => string;
  onOrder: (
    tierKey: string,
    channel: string,
    cycles: number,
    onFail: (code?: string) => void,
  ) => void;
}) {
  const methods = paymentMethods(channels);
  const [cycles, setCycles] = useState(1);
  const [method, setMethod] = useState(methods[0] ?? 'alipay');
  const [afdianBusy, setAfdianBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const methodLabels: Record<string, string> = {
    alipay: copy.channelAlipay,
    wxpay: copy.channelWxpay,
    usdt: copy.channelUsdt,
  };

  const startAfdian = async () => {
    setAfdianBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sponsorship/afdian-order-url/?month=${encodeURIComponent(String(cycles))}`,
      );
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        code?: string;
      } | null;
      if (json?.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      setError(message(json?.code));
      setAfdianBusy(false);
    } catch {
      setError(message());
      setAfdianBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-base font-medium text-foreground">{tier.name}</p>
        <p className="text-sm text-primary">{priceLabel(tier.price, copy)}</p>
        <p className="text-xs text-body-muted">{copy.tierCycle(tier.cycleDays)}</p>
        {tier.creditsPerCycle > 0 && (
          <p className="text-xs text-body-muted">{copy.tierCredits(tier.creditsPerCycle)}</p>
        )}
      </div>

      <FieldGroup className="gap-4 sm:flex-row sm:items-end">
        <Field className="sm:max-w-[10rem]">
          <FieldLabel htmlFor={`cycles-${tier.key}`}>{copy.cyclesLabel}</FieldLabel>
          <Input
            id={`cycles-${tier.key}`}
            type="number"
            min={1}
            max={60}
            value={cycles}
            onChange={(event) => setCycles(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
          />
        </Field>
        {methods.length > 0 && (
          <Field className="sm:max-w-[12rem]">
            <FieldLabel htmlFor={`channel-${tier.key}`}>{copy.channelLabel}</FieldLabel>
            <select
              id={`channel-${tier.key}`}
              value={method}
              onChange={(event) => setMethod(event.target.value as typeof method)}
              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground"
            >
              {methods.map((value) => (
                <option key={value} value={value}>
                  {methodLabels[value]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </FieldGroup>

      <div className="flex flex-wrap gap-2">
        {methods.length > 0 && (
          <Button
            type="button"
            onClick={() => {
              setError(null);
              onOrder(tier.key, method, cycles, (code) => setError(code ?? 'generic'));
            }}
          >
            {copy.buyAction}
          </Button>
        )}
        {channels.afdian && (
          <Button
            type="button"
            variant="outline"
            disabled={afdianBusy}
            onClick={() => void startAfdian()}
          >
            {afdianBusy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
            {copy.afdianAction}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The /membership/ island: daily check-in, redemption, the cashier and the
 * credit ledger. The page ships every read with the SSR shell, so this only
 * performs writes and `load more`; check-in and redemption update local state
 * instead of reloading, which is enough because both answer with the new
 * balance/tier they produced.
 *
 * Every availability question goes to the backend — the check-in button is
 * offered unconditionally and a 409 settles whether the day was already
 * claimed. Nothing here second-guesses an endpoint from its data.
 */
export default function MembershipPanel({
  locale,
  timezone,
  channels,
  items,
  membership,
  entries,
  hasMore,
}: Props) {
  const dict = t(locale);
  const copy = dict.membership;
  const errorCopy = dict.errors as Record<string, string | undefined>;
  const message = (code?: string | null) => (code ? errorCopy[code] : undefined) ?? dict.errors.generic;

  const [balance, setBalance] = useState(membership?.balance ?? 0);
  // Starts available every load: the backend owns the "already claimed" call
  // and answers 409 when it disagrees, so no state is guessed here.
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinNotice, setCheckinNotice] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [redeemChannel, setRedeemChannel] = useState<'redeem' | 'afdian'>('redeem');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemNotice, setRedeemNotice] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [ledger, setLedger] = useState<CreditEntry[]>(entries);
  const [more, setMore] = useState(hasMore);
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);

  const runCheckin = async () => {
    setCheckinBusy(true);
    setCheckinError(null);
    try {
      // The JSON content type keeps this POST out of Astro's form-submission
      // CSRF check, which would otherwise demand an Origin header too.
      const response = await fetch('/api/credits/checkin/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        grant?: { granted: number; balance: number };
        code?: string;
      } | null;
      if (json?.ok && json.grant) {
        setBalance(json.grant.balance);
        setCheckedIn(true);
        setCheckinNotice(copy.checkinGranted(json.grant.granted));
        void refreshLedger();
      } else if (json?.code === 'aiya_credit_checkin_done') {
        // The only source of "already claimed": the backend refused the claim.
        setCheckedIn(true);
        setCheckinNotice(copy.checkinDone);
      } else {
        setCheckinError(message(json?.code));
      }
    } catch {
      setCheckinError(dict.errors.generic);
    } finally {
      setCheckinBusy(false);
    }
  };

  /**
   * Re-reads the first ledger page. A grant answer (`{granted, balance,
   * expiresAt}`) carries no row id, source or ref, so the new bucket cannot
   * be fabricated locally — fetching it keeps the ledger honest without a
   * reload, and the previous page survives a failed refresh.
   */
  const refreshLedger = async () => {
    try {
      const response = await fetch('/api/credits/entries/?page=1');
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        entries?: CreditEntry[];
        pagination?: { hasNext: boolean };
      } | null;
      if (json?.ok && json.entries) {
        setLedger(json.entries);
        setLedgerPage(1);
        setMore(Boolean(json.pagination?.hasNext));
      }
    } catch {
      /* keep the previous page; the next full load refreshes it */
    }
  };

  const runRedeem = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get('code') ?? '').trim();
    if (code === '') return;
    setRedeemBusy(true);
    setRedeemError(null);
    setRedeemNotice(null);
    try {
      const response = await fetch('/api/credits/redeem/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, channel: redeemChannel }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        grant?: { tierName: string; cycles: number };
        code?: string;
      } | null;
      if (json?.ok && json.grant) {
        setRedeemNotice(copy.redeemGranted(json.grant.tierName, json.grant.cycles));
        event.currentTarget.reset();
      } else {
        setRedeemError(message(json?.code));
      }
    } catch {
      setRedeemError(dict.errors.generic);
    } finally {
      setRedeemBusy(false);
    }
  };

  const startOrder = async (
    tierKey: string,
    channel: string,
    cycles: number,
    onFail: (code?: string) => void,
  ) => {
    try {
      const response = await fetch('/api/sponsorship/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey, channel, cycles }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        order?: { submitUrl: string };
        code?: string;
      } | null;
      if (json?.ok && json.order) {
        window.location.href = json.order.submitUrl;
        return;
      }
      onFail(json?.code);
    } catch {
      onFail();
    }
  };

  const loadMore = async () => {
    setLedgerBusy(true);
    try {
      const next = ledgerPage + 1;
      const response = await fetch(`/api/credits/entries/?page=${next}`);
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        entries?: CreditEntry[];
        pagination?: { hasNext: boolean };
      } | null;
      if (json?.ok && json.entries) {
        setLedger((current) => [...current, ...json.entries!]);
        setLedgerPage(next);
        setMore(Boolean(json.pagination?.hasNext));
      }
    } finally {
      setLedgerBusy(false);
    }
  };

  const tiers = purchasableTiers(items);

  return (
    <div className="flex flex-col gap-5">
      {membership && (
        <Section icon={<WalletIcon className="size-4" />} title={copy.walletTitle}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-3xl font-semibold text-foreground">{balance}</p>
            <p className="text-sm text-body-muted">{copy.balanceUnit}</p>
          </div>
          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-body-muted">{copy.statusTitle}</dt>
              <dd className={membership.active ? 'text-primary' : 'text-foreground'}>
                {membership.active ? copy.statusActive : copy.statusInactive}
              </dd>
            </div>
            {membership.expiresAt && (
              <div className="flex gap-2">
                <dt className="text-body-muted">{copy.expiresLabel}</dt>
                <dd className="text-foreground">
                  {displayDateTime(membership.expiresAt, locale, timezone)}
                </dd>
              </div>
            )}
            {membership.nextGrantAt && (
              <div className="flex gap-2">
                <dt className="text-body-muted">{copy.nextGrantLabel}</dt>
                <dd className="text-foreground">
                  {displayDateTime(membership.nextGrantAt, locale, timezone)}
                </dd>
              </div>
            )}
          </dl>
        </Section>
      )}

      {membership && (
        <Section icon={<AwardIcon className="size-4" />} title={copy.queueTitle}>
          {membership.queue.length === 0 ? (
            <p className="text-sm text-body-muted">{copy.queueEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
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
        </Section>
      )}

      {membership && (
        <Section icon={<CalendarCheckIcon className="size-4" />} title={copy.checkinTitle}>
          <p className="text-sm text-body-muted">{copy.checkinDesc}</p>
          <div className="mt-4">
            {checkedIn ? (
              <p role="status" className="text-sm text-foreground">
                {checkinNotice ?? copy.checkinDone}
              </p>
            ) : (
              <Button type="button" disabled={checkinBusy} onClick={() => void runCheckin()}>
                {checkinBusy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
                {copy.checkinAction}
              </Button>
            )}
          </div>
          {checkinError && (
            <p role="alert" className="mt-3 text-sm text-error">
              {checkinError}
            </p>
          )}
        </Section>
      )}

      {membership && (
        <Section icon={<TicketIcon className="size-4" />} title={copy.redeemTitle}>
          <p className="text-sm text-body-muted">{copy.redeemDesc}</p>
          <form onSubmit={(event) => void runRedeem(event)} className="mt-4 flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={redeemChannel === 'redeem' ? 'default' : 'outline'}
                onClick={() => setRedeemChannel('redeem')}
              >
                {copy.redeemTypeCode}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={redeemChannel === 'afdian' ? 'default' : 'outline'}
                onClick={() => setRedeemChannel('afdian')}
              >
                {copy.redeemTypeAfdian}
              </Button>
            </div>
            <FieldGroup className="gap-4 sm:flex-row sm:items-end">
              <Field>
                <FieldLabel htmlFor="redeem-code">
                  {redeemChannel === 'redeem' ? copy.redeemTypeCode : copy.redeemTypeAfdian}
                </FieldLabel>
                <Input
                  id="redeem-code"
                  name="code"
                  required
                  autoComplete="off"
                  placeholder={
                    redeemChannel === 'redeem' ? copy.redeemPlaceholder : copy.redeemAfdianPlaceholder
                  }
                />
              </Field>
              <Button type="submit" disabled={redeemBusy}>
                {redeemBusy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
                {copy.redeemAction}
              </Button>
            </FieldGroup>
          </form>
          {redeemNotice && (
            <p role="status" className="mt-3 text-sm text-foreground">
              {redeemNotice}
            </p>
          )}
          {redeemError && (
            <p role="alert" className="mt-3 text-sm text-error">
              {redeemError}
            </p>
          )}
        </Section>
      )}

      <Section icon={<CoinsIcon className="size-4" />} title={copy.tiersTitle}>
        {tiers.length === 0 ? (
          <p className="text-sm text-body-muted">{copy.tiersEmpty}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {tiers.map((tier) => (
              <TierCard
                key={tier.key}
                tier={tier}
                channels={channels}
                copy={copy}
                message={message}
                onOrder={(tierKey, channel, cycles, onFail) =>
                  void startOrder(tierKey, channel, cycles, onFail)
                }
              />
            ))}
          </div>
        )}
      </Section>

      {membership && (
        <Section icon={<WalletIcon className="size-4" />} title={copy.ledgerTitle}>
          {ledger.length === 0 ? (
            <p className="text-sm text-body-muted">{copy.ledgerEmpty}</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border">
                {ledger.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-sm">
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
                    disabled={ledgerBusy}
                    onClick={() => void loadMore()}
                  >
                    {ledgerBusy ? copy.ledgerLoading : copy.ledgerMore}
                  </Button>
                </div>
              )}
            </>
          )}
        </Section>
      )}
    </div>
  );
}
