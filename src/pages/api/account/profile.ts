import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';
import { cloakProfileMedia } from '@/lib/media';

/** PATCH /api/account/profile/: basic fields + email (needs currentPassword).
    The refreshed user projection is cloaked so the answer never carries the
    WP host, even though today's island only reads `ok`. */
export const PATCH = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  const result = await client.updateProfile(body as Record<string, unknown>);
  return jsonResponse({ ok: true, user: cloakProfileMedia(result.data) });
});
