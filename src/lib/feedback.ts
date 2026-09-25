import { toast } from 'sonner';
import { t, type Locale } from '@/lib/i18n';

/**
 * Feedback copy, the single exit (UX.md §1): a failed call to the same-origin
 * /api proxy resolves its envelope's `aiya_*` code through the shared errors
 * dictionary — islands must not hand-roll the lookup. Forms keep their inline
 * alerts via `apiErrorCopy`; fire-and-forget action failures toast via
 * `toastApiError`.
 */

/** Dictionary copy for one proxy envelope code; the generic line when the
    code is missing or unknown. */
export function apiErrorCopy(code: string | null | undefined, locale: Locale): string {
  const dict = t(locale);
  if (code) {
    const copy = (dict.errors as Record<string, string | undefined>)[code];
    if (copy) return copy;
  }
  return dict.errors.generic;
}

/** Toast the resolved copy of a failed proxy call. */
export function toastApiError(code: string | null | undefined, locale: Locale): void {
  toast.error(apiErrorCopy(code, locale));
}

/**
 * Reload-borne toasts (UX.md §1): session changes re-render server-side, and
 * the reload kills any toast fired just before it. A one-shot sessionStorage
 * handoff lets login/logout show their outcome on the fresh page instead.
 * The Toaster island drains it on mount — exactly one consumer.
 */
const FLASH_KEY = 'aiya-flash-toast';

export interface FlashToast {
  kind: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

/** Queue a toast to be shown after the upcoming full reload. */
export function flashToast(flash: FlashToast): void {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
  } catch {
    /* storage unavailable (private mode etc.) — feedback is lost, not broken */
  }
}

/** Read and clear the queued flash; null when there is none. */
export function consumeFlashToast(): FlashToast | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (raw === null) return null;
    sessionStorage.removeItem(FLASH_KEY);
    const parsed = JSON.parse(raw) as FlashToast;
    return typeof parsed?.message === 'string' && typeof parsed?.kind === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
