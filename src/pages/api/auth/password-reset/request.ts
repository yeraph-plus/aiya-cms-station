import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { siteOrigin } from '@/lib/core/server';

/**
 * POST /api/auth/password-reset/request/: anonymous rate-limited upstream.
 * The reset-link origin comes from AIYA_SITE_URL only — falling back to the
 * request host would let a broken config turn the link into attacker-chosen
 * material. A misconfigured origin fails hard (503); the reset host must
 * also be whitelisted on the backend Security page.
 */
export const POST = defineProxy({ client: 'server' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as { email?: unknown } | null;
  const email = String(body?.email ?? '');
  if (email === '') return jsonResponse({ ok: false }, 400);
  let domain: string;
  try {
    domain = siteOrigin();
  } catch {
    return jsonResponse({ ok: false }, 503);
  }
  await client.passwordResetRequest({ email, domain });
  return jsonResponse({ ok: true });
});
