import { useEffect, useRef, useState } from 'react';

import { CoinsIcon, CrownIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MembershipModal } from '@/components/islands/membership/MembershipModal';
import type { MembershipState } from '@/lib/core/contracts';
import { apiErrorCopy } from '@/lib/feedback';
import { t, type Locale } from '@/lib/i18n';
import { displayDay } from '@/lib/membership';
import { DEFAULT_TIMEZONE } from '@/lib/format';

/** The local marker that today's auto check-in attempt already happened. */
const checkinMarker = (): string => `aiya-checkin-${new Date().toISOString().slice(0, 10)}`;

/**
 * Credit wallet bubble, the third shell bubble next to notifications and the
 * user menu. The trigger shows the live balance; the popover pairs the
 * balance with the currently effective plan, then the daily check-in. The
 * membership entry (opening the purchase modal) is NOT inside the popover —
 * it is a header button right next to the credits chip, reading the same
 * membership fetch: active sponsors see their tier name on the button, everyone
 * else the plain 赞助 label. Renders only for signed-in visitors (UserCenter).
 *
 * "Already claimed today" stays the backend's call — a 409 settles it, the
 * island never guesses from the clock. Active sponsors additionally get the
 * day's check-in performed for them: on mount, an active membership with an
 * open check-in policy triggers one automatic attempt (popover opens so the
 * result is visible), guarded by a local once-per-day marker so page
 * navigation never re-fires it.
 */
/** Daily auto-checkin marker; guarded reads/writes (private mode throws). */
function readCheckinMarker(): string | null {
  try {
    return localStorage.getItem(checkinMarker());
  } catch {
    return null;
  }
}

function writeCheckinMarker(): void {
  try {
    localStorage.setItem(checkinMarker(), '1');
  } catch {
    /* storage unavailable — the backend dedups anyway */
  }
}

export function WalletBubble({ locale, timezone }: { locale: Locale; timezone?: string }) {
  const dict = t(locale);
  const copy = dict.membership;
  const [open, setOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [membership, setMembership] = useState<MembershipState | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [balance, setBalance] = useState<number | null>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  /**
   * One check-in attempt serving two attention contexts (UX.md §1): the
   * automatic page-load attempt fires while the visitor may be anywhere —
   * it toasts on top of the inline notice; a manual click happens with the
   * bubble open and its notice in view, so the toast would only double the
   * line the visitor is already reading.
   */
  const claimCheckin = async (
    channel: 'auto' | 'manual',
  ): Promise<'granted' | 'done' | 'failed' | null> => {
    setCheckinBusy(true);
    setNotice(null);
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
        setDone(true);
        setNotice(copy.checkinGranted(json.grant.granted));
        if (channel === 'auto') toast.success(copy.checkinGranted(json.grant.granted));
        return 'granted';
      }
      if (json?.code === 'aiya_credit_checkin_done') {
        setDone(true);
        setNotice(copy.checkinDone);
        if (channel === 'auto') toast.info(copy.checkinDone);
        return 'done';
      }
      setNotice(apiErrorCopy(json?.code, locale));
      if (channel === 'auto') toast.error(apiErrorCopy(json?.code, locale));
      return 'failed';
    } catch {
      setNotice(dict.errors.generic);
      if (channel === 'auto') toast.error(dict.errors.generic);
      return 'failed';
    } finally {
      setCheckinBusy(false);
    }
  };

  const applyMembership = (next: MembershipState) => {
    setMembership(next);
    setBalance(next.balance);
    setState('ready');
  };

  const fetchWallet = async (): Promise<MembershipState | null> => {
    try {
      const response = await fetch('/api/membership/');
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        membership?: MembershipState;
      } | null;
      if (json?.ok && json.membership) {
        applyMembership(json.membership);
        return json.membership;
      }
      setState('error');
      return null;
    } catch {
      setState('error');
      return null;
    }
  };

  // Same hidden-instance rule as the notification bubble: both shells mount
  // the island and the shell CSS hides exactly one — a display:none instance
  // skips the fetch; opening the popover always refreshes. The visible one
  // also runs the sponsor's automatic daily check-in: active membership +
  // open policy + no local marker for today = one silent attempt, with the
  // popover opening so the grant (or the backend's 409) stays visible.
  useEffect(() => {
    if (rootRef.current && rootRef.current.getClientRects().length === 0) return;
    void (async () => {
      const next = await fetchWallet();
      if (next !== null && next.active && next.checkin.enabled && !readCheckinMarker()) {
        setOpen(true);
        const result = await claimCheckin('auto');
        // Mark only after the backend settled the day (grant or 409): a
        // network blip must not burn the day's only automatic attempt — the
        // backend dedups anyway, so erring toward another attempt is safe.
        if (result === 'granted' || result === 'done') {
          writeCheckinMarker();
        }
      }
    })();
  }, []);

  const handleOpen = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setState('loading');
    void fetchWallet();
  };

  const runCheckin = async () => {
    const result = await claimCheckin('manual');
    // A manual click shares the auto path's daily marker only when the
    // backend settled the day (granted or 409); failures stay re-clickable.
    if (result === 'granted' || result === 'done') writeCheckinMarker();
  };

  const shown = balance ?? membership?.balance ?? null;
  const checkin = membership?.checkin;
  // The currently effective plan: the queue row whose window contains now.
  // Compare ISO strings, not a render-time clock — a pure render must stay
  // deterministic for hydration (membership is null on the SSR pass anyway).
  const nowIso = new Date().toISOString();
  const currentPlan = membership?.queue.find(
    (row) => row.status === 'active' && row.startsAt <= nowIso && nowIso < row.endsAt,
  );

  return (
    /* inline-flex: the span carries TWO buttons now (sponsor + credits) —
       as a flex item it would blockify and stack the two flex-container
       buttons vertically without it. */
    <span ref={rootRef} className="inline-flex items-center gap-1">
      {/* The membership entry, OUTSIDE the popover: crowned header button
          next to the credits chip — active sponsors see their tier name. */}
      <button
        type="button"
        onClick={() => setPlansOpen(true)}
        aria-label={currentPlan ? currentPlan.tierName : copy.sponsorTitle}
        title={currentPlan ? currentPlan.tierName : copy.sponsorTitle}
        className="flex h-8 max-w-40 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-foreground outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
      >
        <CrownIcon className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{currentPlan ? currentPlan.tierName : copy.sponsorTitle}</span>
      </button>
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={copy.walletOpen}
            title={copy.walletOpen}
            className="flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-foreground outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue"
          >
            <CoinsIcon className="size-4" aria-hidden="true" />
            {shown !== null && <span className="font-medium tabular-nums">{shown}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 overflow-hidden p-0">
          {/* Layer 1: the balance with its unit, the effective plan
              underneath. */}
          <div className="flex items-baseline gap-x-1.5 px-4 pt-3">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {shown !== null ? shown : '—'}
            </span>
            <span className="text-sm text-body-muted">{copy.balanceUnit}</span>
          </div>
          <div className="px-4 pb-3">
            {state === 'loading' && (
              <p className="text-xs text-body-muted">
                <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
              </p>
            )}
            {state === 'error' && (
              <p role="alert" className="text-xs text-body-muted">
                {copy.walletLoadFailed}
              </p>
            )}
            {state === 'ready' && (
              <p className="text-xs text-body-muted">
                {currentPlan
                  ? `${currentPlan.tierName} · ${copy.statusActive}${
                      currentPlan.endsAt
                        ? ` · ${copy.expiresLabel} ${displayDay(currentPlan.endsAt, locale, timezone ?? DEFAULT_TIMEZONE)}`
                        : ''
                    }`
                  : copy.statusInactive}
              </p>
            )}
          </div>
          <Separator />
          {/* Layer 2: the daily check-in. Hidden entirely while the site's
              policy has it off; the button disappears once the day is
              claimed, leaving the outcome in its place. */}
          <div className="px-4 py-3">
            {state === 'ready' && checkin?.enabled && !done && (
              <>
                <p className="text-xs leading-5 text-body-muted">
                  {copy.checkinPolicy(checkin.credits, checkin.validityDays)}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 w-full"
                  disabled={checkinBusy}
                  onClick={() => void runCheckin()}
                >
                  {checkinBusy && (
                    <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {copy.checkinAction}
                </Button>
              </>
            )}
            {notice && (
              <p role="status" className="text-sm text-foreground">
                {notice}
              </p>
            )}
            {state === 'ready' && !checkin?.enabled && !notice && (
              <p className="text-xs leading-5 text-body-muted">{copy.checkinClosed}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <MembershipModal open={plansOpen} onOpenChange={setPlansOpen} locale={locale} />
    </span>
  );
}
