import { useState } from 'react';

import { LoaderCircleIcon, TicketIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { Tier } from '@/lib/core/contracts';
import { apiErrorCopy } from '@/lib/feedback';
import EmptyNote from '@/components/islands/EmptyNote';
import { t, type Locale } from '@/lib/i18n';
import { paymentMethods, purchasableTiers } from '@/lib/membership';

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

function money(price: number): string {
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

/**
 * One plan card: the (backend-configured) pricing facts up top, a separator,
 * then the interactive half — the payment channel radio and the buy actions.
 * The cycle count is the tier's own configuration; the buyer picks nothing
 * but how to pay.
 */
function PlanCard({
  tier,
  channels,
  copy,
  message,
  onOrder,
}: {
  tier: Tier;
  channels: Channels;
  copy: MembershipCopy;
  message: (code?: string | null) => string;
  onOrder: (tierKey: string, channel: string, onFail: (code?: string) => void) => void;
}) {
  const methods = paymentMethods(channels);
  const [method, setMethod] = useState<string>(methods[0] ?? '');
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
        `/api/membership/afdian-order-url/?tierKey=${encodeURIComponent(tier.key)}`,
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
    <Card>
      <CardHeader className="pt-6 pb-5">
        {/* The pricing facts, four rows: name / total price + reset cadence /
            per-cycle small print / the configured blurb — no rule between
            them, one blank line's worth of air before the blurb. */}
        <CardTitle className="text-base">{tier.name}</CardTitle>
        <div className="flex items-baseline gap-x-2">
          <p className="text-3xl font-semibold tracking-tight">
            {copy.tierPrice(money(tier.price * tier.cycles))}
          </p>
          <span className="text-xs text-body-muted">{copy.tierReset(tier.cycleDays)}</span>
        </div>
        <CardDescription>{copy.tierPriceLine(money(tier.price), tier.cycles)}</CardDescription>
        {tier.description !== '' && (
          <CardDescription className="mt-4 leading-relaxed">{tier.description}</CardDescription>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-5 pb-5">
        {methods.length > 0 ? (
          <RadioGroup
            value={method}
            onValueChange={setMethod}
            className="flex flex-row flex-wrap gap-2"
          >
            {methods.map((value) => (
              <Label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-normal has-[button[data-state=checked]]:border-primary/60 has-[button[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={value} />
                {methodLabels[value]}
              </Label>
            ))}
          </RadioGroup>
        ) : (
          <p className="text-sm text-body-muted">{copy.channelEmpty}</p>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 pb-6">
        <Button
          type="button"
          className="w-full"
          disabled={methods.length === 0}
          onClick={() => {
            setError(null);
            onOrder(tier.key, method, (code) => setError(message(code)));
          }}
        >
          {copy.buyAction}
        </Button>
        {channels.afdian && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={afdianBusy}
            onClick={() => void startAfdian()}
          >
            {afdianBusy && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
            {copy.afdianAction}
          </Button>
        )}
        {error && (
          <p role="alert" className="w-full text-sm text-error">
            {error}
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * The purchase surface inside the membership modal: plan cards plus the
 * standalone activation form (redeem code or Afdian order number). It
 * renders only for signed-in visitors — the wallet bubble is the one host.
 */
export function MembershipPlans({
  locale,
  channels,
  items,
}: {
  locale: Locale;
  channels: Channels;
  items: Tier[];
}) {
  const dict = t(locale);
  const copy = dict.membership;
  const message = (code?: string | null) => apiErrorCopy(code, locale);

  const [redeemChannel, setRedeemChannel] = useState<'redeem' | 'afdian'>('redeem');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemNotice, setRedeemNotice] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const tiers = purchasableTiers(items);

  const startOrder = async (tierKey: string, channel: string, onFail: (code?: string) => void) => {
    try {
      // The payer returns to the page that opened the modal: the front end
      // derives the landing address from its own location.
      const response = await fetch('/api/membership/orders/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey, channel, returnUrl: window.location.href }),
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

  const runRedeem = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    // React only carries currentTarget through the synchronous dispatch —
    // after the await it is null, so the form handle must be captured up
    // front or the post-success reset() throws and paints the generic
    // error right under the success notice.
    const form = event.currentTarget;
    const code = String(new FormData(form).get('code') ?? '').trim();
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
        grant?:
          | { tierName: string; cycles: number }
          | { granted: number; balance: number; expiresAt: string };
        code?: string;
      } | null;
      if (json?.ok && json.grant) {
        // The backend answers by code kind — membership grants name the
        // queued tier, credit grants carry the balance they just created.
        if ('tierName' in json.grant) {
          setRedeemNotice(copy.redeemGranted(json.grant.tierName, json.grant.cycles));
        } else {
          setRedeemNotice(copy.redeemCredits(json.grant.granted));
        }
        form.reset();
      } else {
        setRedeemError(message(json?.code));
      }
    } catch {
      setRedeemError(dict.errors.generic);
    } finally {
      setRedeemBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {tiers.length === 0 ? (
        <EmptyNote className="px-6 py-8">{copy.tiersEmpty}</EmptyNote>
      ) : (
        // Three columns always visible; further cards (or a viewport too
        // narrow for three) overflow into a horizontal scroll, never a
        // second row.
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="grid auto-cols-[max(calc((100%-2rem)/3),15rem)] grid-flow-col gap-4">
            {tiers.map((tier) => (
              <PlanCard
                key={tier.key}
                tier={tier}
                channels={channels}
                copy={copy}
                message={message}
                onOrder={(tierKey, channel, onFail) => void startOrder(tierKey, channel, onFail)}
              />
            ))}
          </div>
        </div>
      )}

      <Separator />
      <section>
        <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
          <TicketIcon className="size-4 text-primary" aria-hidden="true" />
          {copy.activationTitle}
        </h3>
        <p className="mt-1 text-sm text-body-muted">{copy.redeemDesc}</p>
        <form onSubmit={(event) => void runRedeem(event)} className="mt-3">
          <FieldGroup className="gap-3 sm:flex-row sm:items-end">
            <Field className="sm:w-44">
              <FieldLabel htmlFor="redeem-channel">{copy.channelLabel}</FieldLabel>
              <Select
                value={redeemChannel}
                onValueChange={(value) => setRedeemChannel(value as typeof redeemChannel)}
              >
                <SelectTrigger id="redeem-channel" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="redeem">{copy.redeemTypeCode}</SelectItem>
                  <SelectItem value="afdian">{copy.redeemTypeAfdian}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="flex-1">
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
              {redeemBusy && (
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
              )}
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
      </section>
    </div>
  );
}
