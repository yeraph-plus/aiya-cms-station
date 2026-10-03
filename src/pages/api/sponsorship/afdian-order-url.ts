import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * GET /api/sponsorship/afdian-order-url?tierKey=X: the personalised Afdian
 * deep link. The tier's configured cycles pre-select on the platform page;
 * activation rides Afdian's own webhook, so nothing is queued here.
 */
export const GET = defineProxy({ auth: 'required' }, async ({ client, url }) => {
  const tierKey = url.searchParams.get('tierKey') ?? '';
  if (!/^[a-z0-9_-]{1,32}$/.test(tierKey)) return jsonResponse({ ok: false }, 400);
  const result = await client.afdianOrderUrl(tierKey);
  return jsonResponse({ ok: true, url: result.data.url });
});
