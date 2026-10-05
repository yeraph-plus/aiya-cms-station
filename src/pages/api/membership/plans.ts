import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * GET /api/membership/plans: the public tier list for the membership modal.
 * The backend publishes it anonymously, so this rides the anonymous read
 * client — no session required, purchasable filtering stays the island's job.
 */
export const GET = defineProxy({}, async ({ client }) => {
  const result = await client.tiers();
  return jsonResponse({ ok: true, tiers: result.data });
});
