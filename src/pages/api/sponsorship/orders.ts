import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * POST /api/sponsorship/orders: open the cashier for one tier. Returns the
 * gateway `submitUrl` the browser must be sent to — the payment itself never
 * passes through this front end.
 */
export const POST: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await Astro.request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const payload = body as { tierKey?: unknown; channel?: unknown; cycles?: unknown };
    const result = await authClient(token).createOrder({
      tierKey: String(payload.tierKey ?? ''),
      channel: payload.channel as 'alipay' | 'wxpay' | 'usdt',
      cycles: Number(payload.cycles ?? 1),
    });
    return jsonResponse({ ok: true, order: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
