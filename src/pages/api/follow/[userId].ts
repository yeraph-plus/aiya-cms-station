import { defineProxy, jsonResponse } from '@/lib/api-auth';

/**
 * Same-origin follow proxy for the public profile island. GET answers the
 * relationship state (guests read false), POST/DELETE toggle it; the bearer
 * stays inside the HttpOnly cookie.
 */
export const GET = defineProxy({}, async ({ client, token, params }) => {
  const userId = Number(params.userId);
  if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
  if (!token) return jsonResponse({ ok: true, following: false });
  const result = await client.isFollowing(userId);
  return jsonResponse({ ok: true, following: result.data.following });
});

const toggle = (action: 'follow' | 'unfollow') =>
  defineProxy({ auth: 'required' }, async ({ client, params }) => {
    const userId = Number(params.userId);
    if (!Number.isInteger(userId) || userId < 1) return jsonResponse({ ok: false }, 400);
    const result =
      action === 'follow' ? await client.follow(userId) : await client.unfollow(userId);
    return jsonResponse({ ok: true, following: result.data.following });
  });

export const POST = toggle('follow');
export const DELETE = toggle('unfollow');
