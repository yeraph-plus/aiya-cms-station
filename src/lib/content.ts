import sanitizeHtml from 'sanitize-html';
import { rewriteMediaUrl, rewriteSrcset } from '@/lib/media';
import { boardPaths } from '@/lib/routes';

/**
 * The backend's reference markers (ARCHITECTURE "Zero-routing rule and
 * reference markers"): anchors carry kind + handle as data attributes and
 * never an href — the route templates are ours. The first matching route
 * wins; a marker with unusable handles resolves to no href at all (the
 * anchor degrades to inert text rather than a wrong link).
 */
const REF_ROUTE_PREFIX: Record<string, string> = {
  post: 'posts',
  page: 'pages',
  resource: 'resources',
};

/** Front-end route for one content reference — the same table the
    backend's marker resolver uses, exported for payloads that still
    carry bare type+slug. */
export function postRoute(type: string, slug: string): string {
  return `/${REF_ROUTE_PREFIX[type] ?? 'posts'}/${slug}/`;
}

/**
 * Draft-empty check for the rich-text composers: an image counts as content
 * even with no alt text; otherwise strip tags and look for surviving text.
 * The feed, the thread composer and the comment composer shared this
 * predicate by copy-paste before.
 */
export function htmlHasContent(html: string): boolean {
  return /<img/.test(html) || html.replace(/<[^>]*>/g, '').trim() !== '';
}

function refHref(attribs: Record<string, string>): string | undefined {
  switch (attribs['data-aiya-ref']) {
    case 'post':
      return attribs['data-aiya-type'] !== undefined && attribs['data-aiya-slug'] !== ''
        ? postRoute(attribs['data-aiya-type'], attribs['data-aiya-slug'])
        : undefined;
    case 'user':
      return attribs['data-aiya-nicename'] !== ''
        ? `/profile/${encodeURIComponent(attribs['data-aiya-nicename'])}/`
        : undefined;
    case 'term':
      return attribs['data-aiya-slug'] !== ''
        ? `/categories/${encodeURIComponent(attribs['data-aiya-slug'])}/`
        : undefined;
    case 'search':
      return attribs['data-aiya-q'] !== ''
        ? `/search/${encodeURIComponent(attribs['data-aiya-q'])}/`
        : undefined;
    case 'comment':
      return attribs['data-aiya-type'] !== undefined &&
        attribs['data-aiya-slug'] !== '' &&
        attribs['data-aiya-comment'] !== ''
        ? `${postRoute(attribs['data-aiya-type'], attribs['data-aiya-slug'])}#comment-${attribs['data-aiya-comment']}`
        : undefined;
    case 'thread':
      return attribs['data-aiya-board'] !== ''
        ? boardPaths(encodeURIComponent(attribs['data-aiya-board'])).base
        : undefined;
    default:
      return undefined;
  }
}

/** The shared `a` transform: reference markers become routed anchors;
    every other anchor keeps the media-rewrite path. */
function anchorTransform(
  _tagName: string,
  attribs: Record<string, string>,
): { tagName: string; attribs: Record<string, string> } {
  const ref = refHref(attribs);
  if (ref !== undefined) {
    return { tagName: 'a', attribs: { ...attribs, href: ref } };
  }

  return { tagName: 'a', attribs: { ...attribs, href: rewriteMediaUrl(attribs.href ?? '') } };
}

/**
 * The single sanitization boundary for backend HTML (post and discussion
 * bodies). WP content is data, not trusted markup: widgets, scripts,
 * shortcode output and arbitrary embeds do not pass. The same pass rewrites
 * WP-origin media URLs to the local `/media/` proxy (single-origin contract)
 * — sanitize-html already parses the tree, so no second parser runs.
 */
export function safeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'details',
      'summary',
      'alert',
      'blockquote',
      'strong',
      'em',
      's',
      'u',
      // The related-post card (aiya-core Domain/Parts `post_id`): a `div`
      // carrying only its own data attributes — never a class, so author
      // content cannot borrow site styles.
      'div',
      'span',
      'a',
      'pre',
      'code',
      'figure',
      'figcaption',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'class'],
      div: ['data-post-card', 'data-post-card-body', 'data-card-type', 'data-badges'],
      // `class` survives so backend-injected smilies (`aiya-smilie`) can be
      // sized by CSS; content imgs simply rarely carry one. The lightbox
      // binding class (`aiya-lightbox`) rides the same attribute.
      img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding', 'class'],
      code: ['class'],
      // Template-part markup (aiya-core Domain/Parts): native list/collapse
      // shapes plus the `<alert>` marker tag, the clipboard slot and the
      // related-post card (whose counters ride as raw data as well).
      span: [
        'data-clipboard-slot',
        'data-post-card-part',
        'data-views',
        'data-likes',
        'data-comments',
        'data-rating',
        'data-rating-count',
      ],
      dl: ['data-ratio'],
      details: ['open'],
      alert: ['level', 'title'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    transformTags: {
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          // An empty src would make the browser re-request the current
          // page — drop the attribute when there is no URL to rewrite.
          ...(attribs.src ? { src: rewriteMediaUrl(attribs.src) } : {}),
          ...(attribs.srcset ? { srcset: rewriteSrcset(attribs.srcset) } : {}),
          loading: attribs.loading ?? 'lazy',
          decoding: 'async',
        },
      }),
      a: anchorTransform,
    },
  });
}

/**
 * Discussion variant of the boundary: content imgs stay stripped (the
 * extracted `images` array renders as the card grid instead, so inline
 * images must not double-render) — but backend-injected smilies
 * (`img.aiya-smilie`) pass through, sized by CSS and proxied like every
 * other WP-origin image.
 */
export function sanitizeDiscussionHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'strong',
      'em',
      's',
      'u',
      // The related-post card, same terms as safeContent: data attributes
      // only, no classes from content.
      'div',
      'span',
      'a',
      'pre',
      'code',
      'figure',
      'figcaption',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      code: ['class'],
      div: ['data-post-card', 'data-post-card-body', 'data-card-type', 'data-badges'],
      span: [
        'data-spoiler',
        'data-post-card-part',
        'data-views',
        'data-likes',
        'data-comments',
        'data-rating',
        'data-rating-count',
      ],
      img: ['src', 'alt', 'class'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    transformTags: {
      a: anchorTransform,
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: rewriteMediaUrl(attribs.src) } : {}),
          loading: attribs.loading ?? 'lazy',
          decoding: 'async',
        },
      }),
    },
    // Content images stay stripped (the grid renders them). Only the
    // backend's smilies survive — by PATH, not by the /media/ prefix at
    // large: the transform above rewrites every WP-origin img (uploaded
    // content images included) to /media/, so a prefix check alone would
    // keep exactly the images this pass exists to strip. Smilies are the
    // sole legitimate occupant of `wp-content/aiya_smilies/`, whose URL the
    // transform turns into `/media/aiya_smilies/…` (the wp-content segment
    // is dropped by the cloak, re-added server-side by the proxy). The
    // `aiya-smilie` class alone is not trusted: a crafted
    // `class="aiya-smilie"` must not smuggle a remote pixel through.
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && !(frame.attribs.src ?? '').startsWith('/media/aiya_smilies/'),
  });
}

/**
 * Comment bodies: the backend stores kses-whitelisted restricted HTML (the
 * shared tiptap composer's output — marks, spoilers, uploaded images) and
 * injects its own smilies imgs. This pass is defense in depth: allowed
 * markup survives, uploaded images only when they point at the local
 * media proxy, smilies always, everything else (legacy plain text) stays
 * text.
 */
export function sanitizeCommentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'blockquote',
      'code',
      'span',
      'a',
      'img',
    ],
    allowedAttributes: {
      span: ['data-spoiler'],
      code: ['class'],
      img: ['src', 'alt', 'class', 'loading'],
      // The mention anchor is renderer-injected by the backend (never
      // stored): the route href is added by the shared a-transform below,
      // and raw hrefs from source content stay stripped (kses removed them
      // long before this pass).
      a: ['data-aiya-ref', 'data-aiya-nicename', 'class', 'href'],
    },
    allowedSchemes: ['https', 'http'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
    transformTags: {
      a: anchorTransform,
      img: (_tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: rewriteMediaUrl(attribs.src) } : {}),
          loading: attribs.loading ?? 'lazy',
          decoding: 'async',
        },
      }),
    },
    exclusiveFilter: (frame) => {
      if (frame.tag !== 'img') return false;
      // Only images on the single-origin media proxy survive: the backend's
      // smilies arrive already rewritten (transform above), and uploaded
      // comment images are /media/ by contract. The `aiya-smilie` class
      // alone is not trusted — a crafted class must not smuggle a remote
      // tracking pixel through.
      return !(frame.attribs.src ?? '').startsWith('/media/');
    },
  });
}

/**
 * Notification titles: the backend ships the escaped message wrapped in at
 * most one soft reference anchor (data-aiya-ref, zero-routing). The pass
 * resolves that anchor into the routed href through the shared transform,
 * strips the transport data attributes, and unwraps everything else — a
 * notification title is a link, never rich markup.
 */
export function sanitizeNotificationHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['a'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: anchorTransform },
  });
}
