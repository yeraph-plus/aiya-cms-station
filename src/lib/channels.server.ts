import { rewriteMediaUrl } from '@/lib/media';
import type { ChannelGroup } from '@/lib/channels';

/**
 * Server-side media cloak for the channel mirror (single-origin contract):
 * WP-pool mirror images arrive as WP-absolute URLs on the wire DTO — every
 * path into the browser (the /channels/ page props and the /api/channels
 * proxy) rewrites them to local `/media/...` paths first, so the island
 * never sees the upstream host. Foreign URLs (t.me links, external hosts)
 * pass through untouched by design. Lives apart from lib/channels so the
 * island can runtime-import the pure grouping/render logic without dragging
 * the server env into the client bundle.
 */
export function cloakChannelGroups(groups: readonly ChannelGroup[]): ChannelGroup[] {
  return groups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      media: row.media.map((item) => ({ ...item, url: rewriteMediaUrl(item.url) })),
    })),
  }));
}
