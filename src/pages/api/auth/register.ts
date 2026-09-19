import type { APIRoute } from 'astro';
import { registerRequestSchema } from '@/lib/core/contracts';
import { authClient } from '@/lib/core/server';
import { setSessionCookie } from '@/lib/core/session';
import { errorCode, errorStatus, jsonResponse, requesterLocale, visitorIp } from '@/lib/api-auth';
import { aiyaErrorCopy, t } from '@/lib/i18n';

/** Same-origin registration proxy; success signs the visitor in immediately. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const locale = await requesterLocale();
  const copy = t(locale);

  let body: unknown;
  try {
    body = await Astro.request.json();
  } catch {
    return jsonResponse({ ok: false, message: copy.errors.aiya_invalid_param }, 400);
  }
  const parsed = registerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: copy.errors.aiya_invalid_param }, 400);
  }

  try {
    const session = (await authClient(null, ip).register(parsed.data)).data;
    setSessionCookie(Astro.cookies, session.token, session.expiresAt);
    return jsonResponse({
      ok: true,
      user: { nickname: session.user.nickname, avatarUrl: session.user.avatar.url || null },
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), message: aiyaErrorCopy(error, locale) },
      errorStatus(error),
    );
  }
};
