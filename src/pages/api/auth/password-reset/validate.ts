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

/** POST /api/auth/password-reset/validate/: checks a reset key without consuming it. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const body = (await readJsonBody(Astro.request)) as {
    login?: unknown;
    key?: unknown;
  } | null;
  const login = String(body?.login ?? '');
  const key = String(body?.key ?? '');
  if (login === '' || key === '') return jsonResponse({ ok: false }, 400);
  try {
    const result = await authClient(null, ip).passwordResetValidate({ login, key });
    return jsonResponse({ ok: true, valid: result.data.valid });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
