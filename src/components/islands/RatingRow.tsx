import { useState } from 'react';

import { LoaderCircleIcon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';

export interface RatingRowProps {
  postId: number;
  initialScore: number | null;
  initialCount: number | null;
  /** Localized labels: sr-only verb, the "n raters" formatter, thanks copy. */
  labels: { rating: string; countText: string; thanks: string; failed: string };
  /** Guests cannot write interactions — clicks are intercepted with a toast. */
  loggedIn?: boolean;
  /** Toast copy for the guest intercept. */
  hint?: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Rating control for resource details (the rating counter scope): a
 * five-star track on the contract's 1-10 scale (star × 2). Fully
 * state-driven — every star renders filled or hollow from the current
 * value, so there is no second render layer to drift out of place during
 * hydration. Hover previews, click commits; after the first submission
 * the track freezes (the backend dedupes per visitor and answers the
 * folded score + count). Guests keep the control enabled — their click
 * is intercepted with a toast (the backend's 401 stays as the hard wall).
 * Success/failure surface as toasts; a spinner rides while the write is
 * in flight. The outline shell mirrors the sibling buttons so the whole
 * row reads as one bar.
 */
export default function RatingRow({
  postId,
  initialScore,
  initialCount,
  labels,
  loggedIn = true,
  hint,
}: RatingRowProps) {
  const [score, setScore] = useState(initialScore);
  const [count, setCount] = useState(initialCount ?? 0);
  const [rated, setRated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const display = hover ?? score ?? 0; // 0-10

  const rate = async (value: number) => {
    if (busy || rated) return;
    if (!loggedIn) {
      toast.error(hint);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/content/${postId}/rating/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        score?: number;
        count?: number;
      } | null;
      if (json?.ok && typeof json.score === 'number') {
        setScore(json.score);
        setCount(json.count ?? count + 1);
        setRated(true);
        setHover(null);
        toast.success(labels.thanks);
      } else {
        toast.error(labels.failed);
      }
    } catch {
      toast.error(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-input bg-white px-2 shadow-xs">
      <div
        role="slider"
        aria-label={labels.rating}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={display}
        className="flex items-center"
        onMouseLeave={() => setHover(null)}
      >
        {STARS.map((star) => {
          const value = star * 2;
          const filled = value <= display;
          return (
            <button
              key={star}
              type="button"
              disabled={busy || rated}
              aria-label={`${value}`}
              onMouseEnter={() => setHover(value)}
              onClick={() => void rate(value)}
              className="p-0.5 transition-transform first:pl-0 hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
            >
              <StarIcon
                className={`size-5 ${filled ? 'text-yellow-400' : 'text-body-muted/40'}`}
                fill={filled ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {busy ? (
        <LoaderCircleIcon className="size-4 animate-spin text-body-muted" aria-hidden="true" />
      ) : (
        <span className="text-sm font-medium text-foreground">{score !== null ? score : '—'}</span>
      )}
      {count > 0 && <span className="text-xs text-body-muted">{labels.countText}</span>}
    </div>
  );
}
