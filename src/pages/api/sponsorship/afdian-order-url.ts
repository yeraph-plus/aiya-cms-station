import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * GET /api/sponsorship/afdian-order-url?tierKey=X: the personalised Afdian
 * deep link. The tier's configured cycles pre-select on the platform page;
 * activation rides Afdian's own webhook, so nothing is queued here.
 */
export const GET: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const tierKey = Astro.url.searchParams.get('tierKey') ?? '';
  if (!/^[a-z0-9_-]{1,32}$/.test(tierKey)) return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(token, ip).afdianOrderUrl(tierKey);
    return jsonResponse({ ok: true, url: result.data.url });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
