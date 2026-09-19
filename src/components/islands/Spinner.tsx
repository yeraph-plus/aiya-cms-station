import { LoaderCircleIcon } from 'lucide-react';

interface SpinnerProps {
  /** Description text shown beside the spinner. */
  label: string;
  className?: string;
}

/**
 * Shared loading indicator: spinning lucide loader + description text.
 * Used by the feed loop's auto-load footer and the notifications popover.
 */
export default function Spinner({ label, className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 text-xs text-body-muted ${className}`}
    >
      <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
