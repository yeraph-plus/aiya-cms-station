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
import { readSessionToken } from '@/lib/core/session';

/**
 * POST /api/content/{id}/downloads: claim one file from one of the post's
 * lists. The backend gates the post, prices the row from its list, charges the
 * credit ledger and only then answers the link — so this proxy stays a plain
 * pass-through that hands the link and its extraction code to the island.
 *
 * Anonymous callers are refused here (the backend would answer 401 anyway):
 * a download button needs a session, and the island shows the sign-in prompt
 * from this status instead of an error.
 */
export const POST: APIRoute = async (Astro) => {
  const ip = visitorIp(Astro.request, Astro.clientAddress);
  const id = Number(Astro.params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);

  const body = (await readJsonBody(Astro.request)) as { listId?: unknown; ref?: unknown } | null;
  const listId = typeof body?.listId === 'string' ? body.listId : '';
  const ref = typeof body?.ref === 'string' ? body.ref : '';
  if (listId === '' || ref === '') return jsonResponse({ ok: false }, 400);

  const token = readSessionToken(Astro.cookies);
  if (!token) return jsonResponse({ ok: false }, 401);

  try {
    const result = await authClient(token, ip).claimDownload(id, { listId, ref });
    return jsonResponse({
      ok: true,
      url: result.data.url,
      code: result.data.code,
      price: result.data.price,
      balance: result.data.balance,
    });
  } catch (error) {
    return jsonResponse(
      { ok: false, code: errorCode(error), requestId: errorRequestId(error) },
      errorStatus(error),
    );
  }
};
