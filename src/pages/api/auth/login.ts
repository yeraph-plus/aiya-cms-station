import type { APIRoute } from 'astro';
import { loginRequestSchema } from '@/lib/core/contracts';
import { authClient } from '@/lib/core/server';
import { setSessionCookie } from '@/lib/core/session';
import {
  errorCode,
  errorStatus,
  jsonResponse,
  requesterLocale,
  visitorIp,
  readJsonBody,
} from '@/lib/api-auth';
import { aiyaErrorCopy, t } from '@/lib/i18n';
import { rewriteMediaUrl } from '@/lib/media';

/** Same-origin login proxy: forwards to WP, then turns the bearer into the session cookie. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const locale = await requesterLocale();
  const copy = t(locale);

  // readJsonBody never throws: malformed/oversized bodies arrive as null and
  // fail the schema below.
  const parsed = loginRequestSchema.safeParse(await readJsonBody(Astro.request));
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: copy.errors.aiya_invalid_param }, 400);
  }

  try {
    const session = (await authClient(null, ip).login(parsed.data)).data;
    setSessionCookie(Astro.cookies, session.token, session.expiresAt);
    return jsonResponse({
      ok: true,
      // Cloak server-side: the browser bundle has no WP origin (non-public
      // env), so the island rendering this avatar cannot rewrite it.
      user: {
        nickname: session.user.nickname,
        avatarUrl: session.user.avatar.url ? rewriteMediaUrl(session.user.avatar.url) : null,
      },
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), message: aiyaErrorCopy(error, locale) },
      errorStatus(error),
    );
  }
};
