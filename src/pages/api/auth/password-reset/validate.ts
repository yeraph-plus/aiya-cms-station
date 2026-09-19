import type { APIRoute } from 'astro';
import { errorCode, errorStatus, jsonResponse } from '@/lib/api-auth';
import { authClient } from '@/lib/aiya/server';

/** POST /api/auth/password-reset/validate/: checks a reset key without consuming it. */
export const POST: APIRoute = async (Astro) => {
  const body = (await Astro.request.json().catch(() => null)) as {
    login?: unknown;
    key?: unknown;
  } | null;
  const login = String(body?.login ?? '');
  const key = String(body?.key ?? '');
  if (login === '' || key === '') return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient().passwordResetValidate({ login, key });
    return jsonResponse({ ok: true, valid: result.data.valid });
  } catch (error) {
    return jsonResponse({ ok: false, code: errorCode(error) }, errorStatus(error));
  }
};
