import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/** POST /api/auth/password-reset/reset/: consumes the key, sets the new password. */
export const POST = defineProxy({ client: 'server' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as {
    login?: unknown;
    key?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
  } | null;
  const login = String(body?.login ?? '');
  const key = String(body?.key ?? '');
  const password = String(body?.password ?? '');
  const passwordConfirm = String(body?.passwordConfirm ?? '');
  if (login === '' || key === '' || password === '') return jsonResponse({ ok: false }, 400);
  const result = await client.passwordReset({
    login,
    key,
    password,
    passwordConfirm,
  });
  return jsonResponse({ ok: true, done: result.data.done });
});
