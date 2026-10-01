import { useState } from 'react';

import { HeartIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { toastApiError } from '@/lib/feedback';
import type { Locale } from '@/lib/i18n';

export interface LikeButtonProps {
  postId: number;
  initialLikes: number;
  /** The viewer's own like from the detail payload; false after a refresh
      only when the viewer has not liked (or the window has expired). */
  initialLiked?: boolean;
  labels: {
    /** Visible-name base for screen readers ("点赞"). */
    sr: string;
    success: string;
  };
  /** Guests cannot write interactions — clicks are intercepted with a toast. */
  loggedIn?: boolean;
  /** Toast copy for the guest intercept. */
  hint?: string;
  /** Resolves the failure toast copy through the shared errors dictionary. */
  locale: Locale;
}

/**
 * Like action for post/page details: an outline button with the red heart
 * (hollow before the visitor's own like, filled after) and the counter
 * inside as `+N`; after the visitor's like the button disables (the
 * backend dedupes per visitor). Guests keep the button enabled — their
 * click is intercepted with a toast (the backend's 401 stays as the hard
 * wall). Spinner while the write is in flight; success/failure surface
 * as toasts.
 */
export default function LikeButton({
  postId,
  initialLikes,
  initialLiked = false,
  labels,
  loggedIn = true,
  hint,
  locale,
}: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  const like = async () => {
    if (busy || liked) return;
    if (!loggedIn) {
      toast.error(hint);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/content/${postId}/like/`, { method: 'POST' });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        likes?: number;
        already?: boolean;
        code?: string;
      } | null;
      if (json?.ok && typeof json.likes === 'number') {
        setLikes(json.likes);
        setLiked(true);
        toast.success(labels.success);
      } else {
        toastApiError(json?.code ?? null, locale);
      }
    } catch {
      toastApiError(null, locale);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void like()}
      aria-pressed={liked}
      aria-label={`${labels.sr} +${likes}`}
      disabled={busy || liked}
      title={liked ? labels.success : labels.sr}
      className="text-red-500 hover:text-red-500 dark:text-red-400 dark:hover:text-red-400"
    >
      {busy ? (
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <HeartIcon className="size-4" fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
      )}
      <span aria-hidden="true">+{likes}</span>
    </Button>
  );
}
