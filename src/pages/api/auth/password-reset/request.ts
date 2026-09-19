import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient, siteOrigin } from '@/lib/aiya/server';

/**
 * POST /api/auth/password-reset/request/: anonymous rate-limited upstream.
 * The reset-link origin comes from AIYA_SITE_URL only — falling back to the
 * request host would let a broken config turn the link into attacker-chosen
 * material. A misconfigured origin fails hard (503); the reset host must
 * also be whitelisted on the backend Security page.
 */
export const POST: APIRoute = async (Astro) => {
  const body = (await Astro.request.json().catch(() => null)) as { email?: unknown } | null;
  const email = String(body?.email ?? '');
  if (email === '') return jsonResponse({ ok: false }, 400);
  let domain: string;
  try {
    domain = siteOrigin();
  } catch {
    return jsonResponse({ ok: false }, 503);
  }
  try {
    await authClient().passwordResetRequest({ email, domain });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
