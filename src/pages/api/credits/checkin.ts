import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * POST /api/credits/checkin: claim today's check-in grant. The backend dedupes
 * on the site's calendar day and answers 409 `aiya_credit_checkin_done` for a
 * second attempt, so this proxy stays a straight pass-through.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client }) => {
  const result = await client.creditsCheckin();
  return jsonResponse({ ok: true, grant: result.data });
});
