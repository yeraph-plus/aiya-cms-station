import type { APIRoute } from 'astro';
import {
  errorCode,
  errorRequestId,
  errorStatus,
  jsonResponse,
  readJsonBody,
  visitorIp,
} from '@/lib/api-auth';
import { authClient } from '@/lib/core/server';

/** POST /api/auth/password-reset/reset/: consumes the key, sets the new password. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const body = (await readJsonBody(Astro.request)) as {
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
  try {
    const result = await authClient(null, ip).passwordReset({
      login,
      key,
      password,
      passwordConfirm,
    });
    return jsonResponse({ ok: true, done: result.data.done });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
