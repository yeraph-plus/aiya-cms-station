import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/sponsorship/orders: open the cashier for one tier. Returns the
 * gateway `submitUrl` the browser must be sent to — the payment itself never
 * passes through this front end.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await Astro.request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const payload = body as { tierKey?: unknown; channel?: unknown; returnUrl?: unknown };
    const result = await authClient(token, ip).createOrder({
      tierKey: String(payload.tierKey ?? ''),
      channel: payload.channel as 'alipay' | 'wxpay' | 'usdt',
      // The front end owns the landing address; absent stays absent (the
      // buyer then remains on the gateway page).
      ...(typeof payload.returnUrl === 'string' && payload.returnUrl !== ''
        ? { returnUrl: payload.returnUrl }
        : {}),
    });
    return jsonResponse({ ok: true, order: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
