import { AiyaApiError } from '@/lib/aiya/errors';
import type { Dictionary } from '@/lib/i18n';

export interface PageErrorCopy {
  status: number;
  title: string;
  message: string;
}

/**
 * Maps a failed page resource onto user-facing copy and an HTTP status.
 * Pure (no astro:env), so it is unit-testable; page.server.ts applies it.
 * A missing shell resource (backend down) is never reported as 404.
 */
export function pageError(
  error: unknown,
  opts: { allow404: boolean },
  copy: Dictionary,
): PageErrorCopy {
  if (error instanceof AiyaApiError) {
    if (opts.allow404 && error.status === 404) {
      return { status: 404, title: copy.state.notFoundTitle, message: copy.state.notFoundMessage };
    }
    if (error.kind === 'timeout') {
      return { status: 504, title: copy.state.timeoutTitle, message: copy.state.timeoutMessage };
    }
    if (error.kind === 'configuration') {
      return { status: 503, title: copy.state.unreadyTitle, message: copy.state.unreadyMessage };
    }
  }
  return { status: 502, title: copy.state.backendTitle, message: copy.state.backendMessage };
}
