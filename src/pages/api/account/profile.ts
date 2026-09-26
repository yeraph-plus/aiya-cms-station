import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp, readJsonBody } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';
import { cloakProfileMedia } from '@/lib/media';

/** PATCH /api/account/profile/: basic fields + email (needs currentPassword).
    The refreshed user projection is cloaked so the answer never carries the
    WP host, even though today's island only reads `ok`. */
export const PATCH: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await readJsonBody(Astro.request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(token, ip).updateProfile(body as Record<string, unknown>);
    return jsonResponse({ ok: true, user: cloakProfileMedia(result.data) });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
