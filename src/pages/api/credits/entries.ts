import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * GET /api/credits/entries?page=N: the ledger's older pages. Page 1 arrives
 * with the SSR shell, so this exists only for the island's "load more". A
 * caller `perPage` rides through when present; absent stays absent so the
 * backend's default window decides.
 */
export const GET: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const page = Number(Astro.url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1) return jsonResponse({ ok: false }, 400);
  const perPageRaw = Astro.url.searchParams.get('perPage');
  const perPage = perPageRaw ? Math.min(100, Math.max(1, Number(perPageRaw) || 1)) : undefined;
  try {
    const result = await authClient(token).creditsEntries({
      page,
      ...(perPage !== undefined ? { perPage } : {}),
    });
    return jsonResponse({ ok: true, entries: result.data, pagination: result.meta.pagination });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
