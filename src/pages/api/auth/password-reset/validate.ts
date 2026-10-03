import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/** POST /api/auth/password-reset/validate/: checks a reset key without consuming it. */
export const POST = defineProxy({ client: 'server' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as {
    login?: unknown;
    key?: unknown;
  } | null;
  const login = String(body?.login ?? '');
  const key = String(body?.key ?? '');
  if (login === '' || key === '') return jsonResponse({ ok: false }, 400);
  const result = await client.passwordResetValidate({ login, key });
  return jsonResponse({ ok: true, valid: result.data.valid });
});
