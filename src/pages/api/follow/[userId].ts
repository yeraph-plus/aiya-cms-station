import type { APIRoute, AstroCookies } from 'astro';
import { errorCode, errorRequestId, errorStatus, jsonResponse, visitorIp } from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';
import { readSessionToken } from '@/lib/core/session';

/**
 * Same-origin follow proxy for the public profile island. GET answers the
 * relationship state (guests read false), POST/DELETE toggle it; the bearer
 * stays inside the HttpOnly cookie.
 */
export const GET: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  const ip = visitorIp(request, clientAddress);
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: true, following: false });
  try {
    const result = await authClient(token, ip).isFollowing(userId);
    return jsonResponse({ ok: true, following: result.data.following });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};

export const POST: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  return toggle(cookies, params, 'follow', visitorIp(request, clientAddress));
};

export const DELETE: APIRoute = async ({ cookies, params, request, clientAddress }) => {
  return toggle(cookies, params, 'unfollow', visitorIp(request, clientAddress));
};

async function toggle(
  cookies: AstroCookies,
  params: Record<string, string | undefined>,
  action: 'follow' | 'unfollow',
  ip: string | null,
): Promise<Response> {
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const client = authClient(token, ip);
    const result =
      action === 'follow' ? await client.follow(userId) : await client.unfollow(userId);
    return jsonResponse({ ok: true, following: result.data.following });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
}
