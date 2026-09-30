import type { APIRoute } from 'astro';
import { errorCode, errorRequestId, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { serverClient } from '@/lib/core/server';

/**
 * GET /api/sponsorship/plans: the public tier list for the membership modal.
 * The backend publishes it anonymously, so this rides the anonymous read
 * client — no session required, purchasable filtering stays the island's job.
 */
export const GET: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  try {
    const result = await serverClient(ip).tiers();
    return jsonResponse({ ok: true, tiers: result.data });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
