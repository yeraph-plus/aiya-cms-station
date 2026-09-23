import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * GET /api/sponsorship/membership: the wallet bubble's one read. MembershipState
 * already derives the credit balance and carries the check-in policy, so the
 * shell's wallet entry needs this single call (no separate balance request).
 * Guests answer 401 — the bubble renders only for signed-in visitors anyway.
 */
export const GET: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const result = await authClient(token, ip).myMembership();
    return jsonResponse({ ok: true, membership: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
