import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * GET /api/sponsorship/membership: the wallet bubble's one read. MembershipState
 * already derives the credit balance and carries the check-in policy, so the
 * shell's wallet entry needs this single call (no separate balance request).
 * Guests answer 401 — the bubble renders only for signed-in visitors anyway.
 */
export const GET = defineProxy({ auth: 'required' }, async ({ client }) => {
  const result = await client.myMembership();
  return jsonResponse({ ok: true, membership: result.data });
});
