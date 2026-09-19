import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/account/password/: change the login password. The backend
 * revokes every token, so the island logs the visitor out afterwards.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  const body = await Astro.request.json().catch(() => null);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  try {
    const payload = body as {
      currentPassword?: unknown;
      password?: unknown;
      passwordConfirm?: unknown;
    };
    const result = await authClient(token, ip).changePassword({
      currentPassword: String(payload.currentPassword ?? ''),
      password: String(payload.password ?? ''),
      passwordConfirm: String(payload.passwordConfirm ?? ''),
    });
    return jsonResponse({ ok: true, done: result.data.done });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
