import { rewriteMediaUrl } from './media';
import { sanitizeDiscussionHtml } from './content';
import type { Discussion, DiscussionReply } from '@/lib/core/contracts';

/**
 * Server-side projection for the community feed island: the wire DTOs carry
 * raw HTML and WP-absolute media URLs — the island receives text-safe HTML
 * (inline images stripped; the extracted images array renders as the grid)
 * and cloaked URLs only. Shared by the /community/ page props and the
 * /api/discussions proxies so every path into the browser is identical.
 */

type CardImage = { url: string; alt: string; width: number | null; height: number | null };

export type FeedThread = Omit<Discussion, 'contentHtml' | 'images'> & {
  contentSafe: string;
  images: CardImage[];
};

export type FeedReply = Omit<DiscussionReply, 'content' | 'images'> & {
  contentSafe: string;
  images: CardImage[];
};

function cloakImage(img: CardImage): CardImage {
  return { ...img, url: rewriteMediaUrl(img.url) };
}

function cloakAuthor(author: Discussion['author']): Discussion['author'] {
  return {
    ...author,
    avatar: author.avatar ? { ...author.avatar, url: rewriteMediaUrl(author.avatar.url) } : null,
  };
}

export function cloakDiscussion(discussion: Discussion): FeedThread {
  // Rest-destructure the raw HTML away: a spread would carry it (and the
  // WP-absolute URLs inside) onto the wire despite the Omit in the type —
  // Omit is compile-time only. The browser receives contentSafe, nothing else.
  const { contentHtml, ...thread } = discussion;
  return {
    ...thread,
    contentSafe: sanitizeDiscussionHtml(contentHtml),
    images: thread.images.map(cloakImage),
    author: cloakAuthor(thread.author),
  };
}

export function cloakReply(reply: DiscussionReply): FeedReply {
  const { content, ...row } = reply;
  // Reply bodies may be rich HTML (Tiptap composer) — always rendered
  // through the sanitizer, never raw; `content` itself never ships.
  return {
    ...row,
    contentSafe: sanitizeDiscussionHtml(content),
    images: row.images.map(cloakImage),
    author: cloakAuthor(row.author),
  };
}
