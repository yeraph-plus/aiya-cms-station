import { defineProxy, errorCode, errorRequestId, errorStatus, jsonResponse } from '@/lib/api-auth';
import { serverClient } from '@/lib/core/server';

/**
 * Same-origin notification feed proxy. The bearer lives in an HttpOnly
 * cookie, so the browser never touches WP directly. No session gate
 * (0.96.0): signed-in visitors get their targeted rows and rank-gated
 * broadcasts, guests get the backend's guest-level broadcast slice — the
 * same endpoint personalizes itself from the resolved viewer. Page and
 * perPage ride through for the /notifications/ page's pagination.
 */
export const GET = defineProxy({}, async ({ client, ip, token, url }) => {
  // Clamped at the proxy: integers only, page ≥ 1, perPage inside the
  // proxy cap of 50 (mirroring the client's own clamp) — malformed values
  // degrade to defaults.
  const pageRaw = Math.floor(Number(url.searchParams.get('page') ?? 1));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const perPageRaw = Number(url.searchParams.get('perPage') ?? 0);
  const perPage =
    Number.isInteger(perPageRaw) && perPageRaw >= 1 ? Math.min(perPageRaw, 50) : undefined;
  const project = (feed: {
    data: unknown[];
    meta: { pagination: { page: number; totalPages: number; hasNext: boolean } };
  }) => ({
    ok: true as const,
    items: feed.data,
    pagination: {
      page: feed.meta.pagination.page,
      totalPages: feed.meta.pagination.totalPages,
      hasNext: feed.meta.pagination.hasNext,
    },
  });
  try {
    const feed = await client.notifications({ page, ...(perPage ? { perPage } : {}) });
    return jsonResponse(project(feed));
  } catch (error) {
    // A dead session (revoked/expired bearer) answers 401 — degrade to the
    // anonymous feed instead of sticking the bell in an error state.
    if (token && errorStatus(error) === 401) {
      try {
        const feed = await serverClient(ip).notifications({
          page,
          ...(perPage ? { perPage } : {}),
        });
        return jsonResponse(project(feed));
      } catch {
        /* fall through to the error answer */
      }
    }
    // Backend down: the bell degrades to an error note instead of
    // breaking the shell.
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
});
