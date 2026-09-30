import type { APIRoute } from 'astro';
import {
  errorCode,
  errorRequestId,
  errorStatus,
  jsonResponse,
  readJsonBody,
  visitorIp,
} from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/credits/redeem: redeem a membership code (`channel: 'redeem'`) or
 * activate an Afdian order number (`channel: 'afdian'`). Both queue a tier
 * rather than granting credits, so the island re-reads membership state.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await readJsonBody(Astro.request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const payload = body as { code?: unknown; channel?: unknown };
    const channel = payload.channel === 'afdian' ? 'afdian' : 'redeem';
    const result = await authClient(token, ip).redeemCode(String(payload.code ?? ''), channel);
    return jsonResponse({ ok: true, grant: result.data });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
