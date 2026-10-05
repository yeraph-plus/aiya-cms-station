import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { siteOrigin } from '@/lib/core/server';

/**
 * POST /api/membership/orders: open the cashier for one tier. Returns the
 * gateway `submitUrl` the browser must be sent to — the payment itself never
 * passes through this front end.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  const payload = body as { tierKey?: unknown; channel?: unknown; returnUrl?: unknown };
  // The landing address is ours to pick: the client may ask for the page it
  // opened the modal on, but only same-origin — an arbitrary returnUrl would
  // have the gateway drop the payer on any host after payment (an open
  // redirect into a phishing lane). Everything else degrades to the wallet.
  let returnUrl = `${siteOrigin()}/profile/me/`;
  if (typeof payload.returnUrl === 'string' && payload.returnUrl !== '') {
    try {
      const parsed = new URL(payload.returnUrl);
      // Credentials in the URL would pass the origin check yet fail the
      // backend's httpUrlSchema (a 400 instead of a graceful fallback).
      if (parsed.origin === siteOrigin() && !parsed.username && !parsed.password) {
        returnUrl = payload.returnUrl;
      }
    } catch {
      /* non-URL input keeps the default */
    }
  }
  const result = await client.createOrder({
    tierKey: String(payload.tierKey ?? ''),
    channel: payload.channel as 'alipay' | 'wxpay' | 'usdt',
    returnUrl,
  });
  return jsonResponse({ ok: true, order: result.data });
});
