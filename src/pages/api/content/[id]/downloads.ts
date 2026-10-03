import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

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
export const POST = defineProxy({ auth: 'required' }, async ({ client, params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false }, 400);

  const body = (await readJsonBody(request)) as { listId?: unknown; ref?: unknown } | null;
  const listId = typeof body?.listId === 'string' ? body.listId : '';
  const ref = typeof body?.ref === 'string' ? body.ref : '';
  if (listId === '' || ref === '') return jsonResponse({ ok: false }, 400);

  const result = await client.claimDownload(id, { listId, ref });
  return jsonResponse({
    ok: true,
    url: result.data.url,
    code: result.data.code,
    price: result.data.price,
    balance: result.data.balance,
  });
});
