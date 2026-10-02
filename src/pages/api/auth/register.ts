import type { APIRoute } from 'astro';
import { registerRequestSchema } from '@/lib/core/contracts';
import { authClient } from '@/lib/core/server';
import { legacySessionDeleteHeader, setSessionCookie } from '@/lib/core/session';
import {
  errorCode,
  errorRequestId,
  errorStatus,
  jsonResponse,
  readJsonBody,
  requesterLocale,
  requestHost,
  visitorIp,
} from '@/lib/api-auth';
import { aiyaErrorCopy, t } from '@/lib/i18n';
import { rewriteMediaUrl } from '@/lib/media';

/** Same-origin registration proxy; success signs the visitor in immediately. */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const locale = await requesterLocale();
  const copy = t(locale);

  // readJsonBody never throws: malformed/oversized bodies arrive as null and
  // fail the schema below.
  const parsed = registerRequestSchema.safeParse(await readJsonBody(Astro.request));
  if (!parsed.success) {
    return jsonResponse({ ok: false, message: copy.errors.aiya_invalid_param }, 400);
  }

  try {
    const session = (await authClient(null, ip).register(parsed.data)).data;
    // Same legacy-shape cleanup gate as login: the delete header targets
    // the host-only shape only — on a host-only deployment it would erase
    // the fresh cookie (scope undefined there), so it is skipped.
    const scope = setSessionCookie(
      Astro.cookies,
      session.token,
      session.expiresAt,
      requestHost(Astro.request),
    );
    const response = jsonResponse({
      ok: true,
      // Cloak server-side like login: the browser bundle has no WP origin.
      user: {
        nickname: session.user.nickname,
        avatarUrl: session.user.avatar.url ? rewriteMediaUrl(session.user.avatar.url) : null,
      },
    });
    if (scope !== undefined) {
      response.headers.append('set-cookie', legacySessionDeleteHeader());
    }
    return response;
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        code: errorCode(error),
        requestId: errorRequestId(error),
        message: aiyaErrorCopy(error, locale),
      },
      errorStatus(error),
    );
  }
};
