import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient, serverClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * Same-origin notification feed proxy. The bearer lives in an HttpOnly
 * cookie, so the browser never touches WP directly. No session gate
 * (0.96.0): signed-in visitors get their targeted rows and rank-gated
 * broadcasts, guests get the backend's guest-level broadcast slice — the
 * same endpoint personalizes itself from the resolved viewer. Page and
 * perPage ride through for the /notifications/ page's pagination.
 */
export const GET: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const token = readSessionToken(cookies);
  const url = new URL(request.url);
  // Clamped at the proxy: integers only, page ≥ 1, perPage inside the
  // backend's own 1-100 ceiling — malformed values degrade to defaults.
  const pageRaw = Math.floor(Number(url.searchParams.get('page') ?? 1));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const perPageRaw = Number(url.searchParams.get('perPage') ?? 0);
  const perPage =
    Number.isInteger(perPageRaw) && perPageRaw >= 1 ? Math.min(perPageRaw, 50) : undefined;
  try {
    const client = token ? authClient(token, ip) : serverClient(ip);
    const feed = await client.notifications({ page, ...(perPage ? { perPage } : {}) });
    return jsonResponse({
      ok: true,
      items: feed.items,
      pagination: {
        page: feed.meta.pagination.page,
        totalPages: feed.meta.pagination.totalPages,
        hasNext: feed.meta.pagination.hasNext,
      },
    });
  } catch (error) {
    // A dead session (revoked/expired bearer) answers 401 — degrade to the
    // anonymous feed instead of sticking the bell in an error state.
    if (token && errorStatus(error) === 401) {
      try {
        const feed = await serverClient(ip).notifications({
          page,
          ...(perPage ? { perPage } : {}),
        });
        return jsonResponse({
          ok: true,
          items: feed.items,
          pagination: {
            page: feed.meta.pagination.page,
            totalPages: feed.meta.pagination.totalPages,
            hasNext: feed.meta.pagination.hasNext,
          },
        });
      } catch {
        /* fall through to the error answer */
      }
    }
    // Backend down: the bell degrades to an error note instead of
    // breaking the shell.
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
