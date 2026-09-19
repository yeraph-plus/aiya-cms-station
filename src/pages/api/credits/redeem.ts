import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * POST /api/credits/redeem: redeem a membership code (`channel: 'redeem'`) or
 * activate an Afdian order number (`channel: 'afdian'`). Both queue a tier
 * rather than granting credits, so the island re-reads membership state.
 */
export const POST: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await Astro.request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const payload = body as { code?: unknown; channel?: unknown };
    const channel = payload.channel === 'afdian' ? 'afdian' : 'redeem';
    const result = await authClient(token).redeemCode(String(payload.code ?? ''), channel);
    return jsonResponse({ ok: true, grant: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
