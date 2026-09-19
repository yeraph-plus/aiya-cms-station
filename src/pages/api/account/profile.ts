import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/** PATCH /api/account/profile/: basic fields + email (needs currentPassword). */
export const PATCH: APIRoute = async (Astro) => {
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await Astro.request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(token).updateProfile(body as Record<string, unknown>);
    return jsonResponse({ ok: true, user: result.data });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
