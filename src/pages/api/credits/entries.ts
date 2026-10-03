import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * GET /api/credits/entries?page=N: the ledger's older pages. Page 1 arrives
 * with the SSR shell, so this exists only for the island's "load more". A
 * caller `perPage` rides through when present; absent stays absent so the
 * backend's default window decides.
 */
export const GET = defineProxy({ auth: 'required' }, async ({ client, url }) => {
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1) return jsonResponse({ ok: false }, 400);
  const perPageRaw = url.searchParams.get('perPage');
  const perPage = perPageRaw ? Math.min(100, Math.max(1, Number(perPageRaw) || 1)) : undefined;
  const result = await client.creditsEntries({
    page,
    ...(perPage !== undefined ? { perPage } : {}),
  });
  return jsonResponse({ ok: true, entries: result.data, pagination: result.meta.pagination });
});
