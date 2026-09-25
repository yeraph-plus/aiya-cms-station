import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Inline empty hint (UX.md §4): the dashed hairline strip for "nothing
 * here yet" one-liners inside cards and tabs. Rich empty states (icon +
 * title + description) stay on `ui/empty`; this is the light variant —
 * one recipe so the eight hand-rolled copies stay identical.
 */
export default function EmptyNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted',
        className,
      )}
    >
      {children}
    </p>
  );
}
