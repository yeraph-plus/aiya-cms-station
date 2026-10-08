import { defineProxy, jsonResponse, readJsonBody } from '@/lib/api-auth';

/** The support chat's visitor proxy (login-only — the conversation derives
    from the authenticated user server-side). GET answers the one thread
    newest first with the standard pagination; POST sends one message —
    stored first, relayed to the owner's Telegram second, rate-limited
    backend-side (10/60s → aiya_rate_limited), which the modal surfaces as
    a toast through the shared error channel. */
export const GET = defineProxy({ auth: 'required' }, async ({ client, url }) => {
  const pageRaw = url.searchParams.get('page');
  const perPageRaw = url.searchParams.get('perPage');
  const result = await client.chatMessages({
    ...(pageRaw !== null && /^\d+$/.test(pageRaw) ? { page: Number(pageRaw) } : {}),
    ...(perPageRaw !== null && /^\d+$/.test(perPageRaw) ? { perPage: Number(perPageRaw) } : {}),
  });
  return jsonResponse({
    ok: true,
    items: result.data,
    pagination: result.meta.pagination,
  });
});

export const POST = defineProxy({ auth: 'required' }, async ({ client, request }) => {
  const body = (await readJsonBody(request)) as { body?: unknown } | null;
  if (!body || typeof body.body !== 'string' || body.body.trim() === '') {
    return jsonResponse({ ok: false }, 400);
  }
  const result = await client.chatSend(body.body);
  return jsonResponse({ ok: true, message: result.data });
});
