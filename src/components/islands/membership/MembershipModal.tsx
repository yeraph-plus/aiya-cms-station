import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { TiersPayload } from '@/lib/core/contracts';
import { t, type Locale } from '@/lib/i18n';
import { MembershipPlans } from './MembershipPlans';

/**
 * The membership purchase modal, hosted by the shell's wallet bubble: plan
 * cards plus the activation form live here instead of a /membership/ page.
 * The tier list is public, so it is fetched once per opening (fresh pricing,
 * no stale cache in a long-lived shell session) and the modal renders a
 * loading line while it arrives.
 */
export function MembershipModal({
  open,
  onOpenChange,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}) {
  const dict = t(locale);
  const copy = dict.membership;
  const [tiers, setTiers] = useState<TiersPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch('/api/sponsorship/plans/');
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          tiers?: TiersPayload;
        } | null;
        if (alive) setTiers(json?.ok && json.tiers ? json.tiers : null);
        if (alive) setFailed(!json?.ok);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{copy.sponsorTitle}</DialogTitle>
          <DialogDescription>{copy.modalDescription}</DialogDescription>
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-sm text-body-muted">
            {dict.errors.generic}
          </p>
        )}
        {!failed && !tiers && (
          <p className="py-8 text-center text-sm text-body-muted">{copy.modalLoading}</p>
        )}
        {tiers && <MembershipPlans locale={locale} channels={tiers.channels} items={tiers.items} />}
      </DialogContent>
    </Dialog>
  );
}
