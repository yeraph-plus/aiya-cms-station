import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Popover-based destructive-action confirmation (UX.md §1): an in-page
 * bubble anchored to the trigger, replacing native window.confirm. Row-level
 * destructive actions (delete thread/reply, remove avatar) confirm here;
 * the popover closes only when the action reports success.
 */
export default function ConfirmPopover({
  text,
  cancelLabel,
  confirmLabel,
  onConfirm,
  children,
}: {
  text: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Resolves `true` on success — the popover closes only then. */
  onConfirm: () => Promise<boolean>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const okFlag = await onConfirm();
      setOpen(okFlag);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto max-w-[220px] p-3">
        <p className="text-sm text-foreground">{text}</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => void run()}>
            {confirmLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
