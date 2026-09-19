import type { APIRoute, AstroCookies } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';
import { readSessionToken } from '@/lib/aiya/session';

/**
 * Same-origin follow proxy for the public profile island. GET answers the
 * relationship state (guests read false), POST/DELETE toggle it; the bearer
 * stays inside the HttpOnly cookie.
 */
export const GET: APIRoute = async ({ cookies, params }) => {
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: true, following: false });
  try {
    const result = await authClient(token).isFollowing(userId);
    return jsonResponse({ ok: true, following: result.data.following });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};

export const POST: APIRoute = async ({ cookies, params }) => {
  return toggle(cookies, params, 'follow');
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  return toggle(cookies, params, 'unfollow');
};

async function toggle(
  cookies: AstroCookies,
  params: Record<string, string | undefined>,
  action: 'follow' | 'unfollow',
): Promise<Response> {
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
  const token = readSessionToken(cookies);
  if (!token) return jsonResponse({ ok: false }, 401);
  try {
    const client = authClient(token);
    const result =
      action === 'follow' ? await client.follow(userId) : await client.unfollow(userId);
    return jsonResponse({ ok: true, following: result.data.following });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
}
