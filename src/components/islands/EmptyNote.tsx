import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Inline empty hint (UX.md §4): the dashed hairline strip for "nothing
 * here yet" one-liners inside cards and tabs. Rich empty states (icon +
 * title + description) stay on `ui/empty`; this is the light variant —
 * one recipe so the eight hand-rolled copies stay identical.
 *
 * With `onClick` the same recipe renders as a full-width button (cursor,
 * hover hairline, focus ring) — e.g. the community guest composer gate
 * popping the login dialog through the `aiya:open-auth` bridge.
 */
export default function EmptyNote({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cls = cn(
    'rounded-lg border border-dashed border-border bg-surface px-6 py-6 text-center text-sm text-body-muted',
    className,
    onClick &&
      'w-full cursor-pointer transition-colors hover:border-body-muted focus-visible:outline-2 focus-visible:outline-focus-blue',
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  return <p className={cls}>{children}</p>;
}
