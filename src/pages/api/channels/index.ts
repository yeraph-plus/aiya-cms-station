import { defineProxy, jsonResponse } from '@/lib/api-auth';
import { groupChannelRows } from '@/lib/channels';
import { cloakChannelGroups } from '@/lib/channels.server';

/** GET /api/channels/: public paged channel mirror for the island's
    auto-load. Answers arrive pre-grouped into album groups with cloaked
    media URLs, so client-fetched pages render exactly like the SSR first
    page (rows immutable, anonymous read — same shape as the page props).
    `channelId` filters to one source channel, `search` substring-matches
    the message text — both ride the wire verbatim to the backend. The
    NSFW soft switch never excludes rows on this surface: both read paths
    override the factory flag off, and sensitive channel media blurs
    island-side instead (identical to the SSR first page). */
export const GET = defineProxy({ nsfw: true }, async ({ client, url }) => {
  const pageRaw = url.searchParams.get('page');
  const perPageRaw = url.searchParams.get('perPage');
  const channelRaw = url.searchParams.get('channelId');
  const search = url.searchParams.get('search') ?? '';
  const result = await client.channelFeed({
    excludeNsfw: false,
    ...(pageRaw !== null && /^\d+$/.test(pageRaw) ? { page: Number(pageRaw) } : {}),
    ...(perPageRaw !== null && /^\d+$/.test(perPageRaw) ? { perPage: Number(perPageRaw) } : {}),
    // Telegram chat ids are negative — keep the sign.
    ...(channelRaw !== null && /^-?\d+$/.test(channelRaw) ? { channelId: Number(channelRaw) } : {}),
    ...(search.trim() !== '' ? { search } : {}),
  });
  return jsonResponse({
    ok: true,
    groups: cloakChannelGroups(groupChannelRows(result.data)),
    pagination: result.meta.pagination,
  });
});
