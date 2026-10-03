import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/**
 * POST /api/credits/redeem: redeem a membership code (`channel: 'redeem'`) or
 * activate an Afdian order number (`channel: 'afdian'`). Both queue a tier
 * rather than granting credits, so the island re-reads membership state.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  const payload = body as { code?: unknown; channel?: unknown };
  const channel = payload.channel === 'afdian' ? 'afdian' : 'redeem';
  const result = await client.redeemCode(String(payload.code ?? ''), channel);
  return jsonResponse({ ok: true, grant: result.data });
});
