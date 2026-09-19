import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/credits/checkin: claim today's check-in grant. The backend dedupes
 * on the site's calendar day and answers 409 `aiya_credit_checkin_done` for a
 * second attempt, so this proxy stays a straight pass-through.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const result = await authClient(token, ip).creditsCheckin();
    return jsonResponse({ ok: true, grant: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
