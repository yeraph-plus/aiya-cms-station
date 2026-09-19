import { rewriteMediaUrl } from './media';
import { sanitizeDiscussionHtml } from './content';
import type { Discussion, DiscussionReply } from '@/lib/aiya/contracts';

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
  return {
    ...discussion,
    contentSafe: sanitizeDiscussionHtml(discussion.contentHtml),
    images: discussion.images.map(cloakImage),
    author: cloakAuthor(discussion.author),
  };
}

export function cloakReply(reply: DiscussionReply): FeedReply {
  return {
    ...reply,
    // Reply bodies may be rich HTML (Tiptap composer) — always rendered
    // through the sanitizer, never raw.
    contentSafe: sanitizeDiscussionHtml(reply.content),
    images: reply.images.map(cloakImage),
    author: cloakAuthor(reply.author),
  };
}
