import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/**
 * POST /api/account/password/: change the login password. The backend
 * revokes every token, so the island logs the visitor out afterwards.
 */
export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = await readJsonBody(request);
  if (body === null || typeof body !== 'object') return jsonResponse({ ok: false }, 400);
  const payload = body as {
    currentPassword?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
  };
  const result = await client.changePassword({
    currentPassword: String(payload.currentPassword ?? ''),
    password: String(payload.password ?? ''),
    passwordConfirm: String(payload.passwordConfirm ?? ''),
  });
  return jsonResponse({ ok: true, done: result.data.done });
});
