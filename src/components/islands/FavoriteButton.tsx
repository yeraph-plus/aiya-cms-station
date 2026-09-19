import { useState } from 'react';

import { BookmarkIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export interface FavoriteButtonProps {
  postId: number;
  /** Localized action labels (common.favorite / favorited / failed family). */
  labels: {
    favorite: string;
    favorited: string;
    failed: string;
    removed: string;
    removeFailed: string;
  };
  /** Guests cannot write interactions — clicks are intercepted with a toast. */
  loggedIn?: boolean;
  /** Toast copy for the guest intercept. */
  hint?: string;
}

/**
 * Favorite toggle for post/page details: a white button with the orange
 * bookmark — filled plus the "已收藏" label once marked (the detail DTO
 * carries no per-viewer flag, so the toggle starts unmarked and converges
 * on the server answer; the /profile/ favorites tab is the source of
 * truth). Guests keep the button enabled — their click is intercepted
 * with a toast (the backend's 401 stays as the hard wall). Spinner while
 * a write is in flight; success/failure surface as toasts.
 */
export default function FavoriteButton({
  postId,
  labels,
  loggedIn = true,
  hint,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    if (!loggedIn) {
      toast.error(hint);
      return;
    }
    setBusy(true);
    try {
      const response = favorited
        ? await fetch(`/api/account/favorites/${postId}/`, { method: 'DELETE' })
        : await fetch('/api/account/favorites/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId }),
          });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        favorited?: boolean;
      } | null;
      if (json?.ok && typeof json.favorited === 'boolean') {
        setFavorited(json.favorited);
        toast.success(json.favorited ? labels.favorited : labels.removed);
      } else {
        toast.error(favorited ? labels.removeFailed : labels.failed);
      }
    } catch {
      toast.error(favorited ? labels.removeFailed : labels.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void toggle()}
      aria-pressed={favorited}
      disabled={busy}
      className="bg-white text-foreground hover:bg-white/90"
    >
      {busy ? (
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <BookmarkIcon
          className="size-4 text-orange-500"
          fill={favorited ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      )}
      {favorited ? labels.favorited : labels.favorite}
    </Button>
  );
}
