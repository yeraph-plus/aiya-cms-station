import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * GET /api/sponsorship/afdian-order-url?month=N: the personalised Afdian deep
 * link. Activation rides Afdian's own webhook, so nothing is queued here.
 */
export const GET: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const raw = Astro.url.searchParams.get('month');
  const month = raw === null ? undefined : Number(raw);
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 36)) {
    return jsonResponse({ ok: false }, 400);
  }
  try {
    const result = await authClient(token, ip).afdianOrderUrl(month);
    return jsonResponse({ ok: true, url: result.data.url });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
