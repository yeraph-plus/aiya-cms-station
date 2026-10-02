import { decodeHTML } from 'entities';
import { z } from 'zod';

/**
 * Wire contract for the WordPress headless API (`aiya/core/v1`).
 *
 * This file mirrors the PHP DTOs in `wp-content/plugins/aiya-core/src/Api/Contract/`
 * field by field — it is the single source the client validates every response
 * against. A backend contract bump (Contract::VERSION) must land here first.
 *
 * Reshaped 2026-09 against backend 0.28.0: Topic domain removed (topics are a
 * category-aggregation template, not an API resource), Discussion rebuilt in
 * its thread form (type/status workflow, server-derived can* flags,
 * no community likes), resource attachments switched to the gate-matrix shape,
 * `tweet`/`issue` type values dropped (dead domains).
 */
export const apiVersion = '1' as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const id = z.number().int().positive();
const count = z.number().int().nonnegative();

/**
 * Site-relative path with an optional query string: no protocol relativity,
 * no traversal, no encoded separators. The query must survive — the backend's
 * `ContentBlocks::normalizeUrl()` deliberately preserves it (a menu row
 * pointing at a filtered list such as `/posts/?category=tech` is authored
 * output), so rejecting `?` here bricks the whole site off one /site payload.
 */
export const sitePathSchema = z
  .string()
  .regex(/^\/(?!\/)[^\\\s?#]*(\?[^\\\s?#]*)?$/)
  .refine((value) => {
    // Traversal checks speak path semantics; the query string is opaque data
    // (a literal `%2f` inside a query value is a legal encoded argument).
    const path = value.split('?')[0] ?? value;
    return !/%(?:2f|5c|2e)/i.test(path) && !path.split('/').includes('..');
  }, 'Expected a safe site-relative path');

export const httpUrlSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
  // zod does not wrap refine exceptions: an unparseable URL must reject,
  // not throw out of safeParse.
  try {
    const url = new URL(value);
    return !url.username && !url.password;
  } catch {
    return false;
  }
}, 'URLs must not contain credentials');

/**
 * A click target authored in the WordPress admin: either a bare front-end
 * path or an absolute external URL. Mirrors the backend's own rule
 * (`ContentBlocks::normalizeUrl()`, `PrimaryMenu::normalizeUrl()`), which
 * collapses anything pointing at this site to a path and passes the rest
 * through untouched — so a site-relative `/promo/` is expected output, not
 * a malformed payload. Narrowing this to absolute-only gates the whole site.
 */
export const linkTargetSchema = z.union([sitePathSchema, httpUrlSchema]);

/** ISO 8601 with a timezone offset, as every backend date field is emitted. */
export const isoSchema = z.iso.datetime({ offset: true });
/** The backend answers `''` (not null) wherever an optional date is absent. */
export const isoOrEmptySchema = z.union([isoSchema, z.literal('')]);

/**
 * WP ships display text in HTML-entity wire form: `the_title`/`the_excerpt`
 * run wptexturize at read time (`--` → `&#8211;`, straight quotes → curly,
 * `...` → `&#8230;`), and stored text keeps `&amp;`-style references — the
 * API forwards all of it verbatim, while every renderer here emits plain
 * text (Astro/React auto-escaping). Plain-text fields therefore decode once
 * right here, at the contract boundary: every payload (SSR reads and the
 * /api/* proxies re-serving islands) parses through these schemas, so no
 * renderer ever sees the wire form. Deliberately NOT decoded: HTML payload
 * fields (content.html / contentHtml / bodyHtml — entity-decoding them
 * could resurrect markup ahead of the sanitizer) and round-trip tokens
 * (discussion tags feed the closed-loop search that matches raw content).
 *
 * `@wordpress/html-entities` is the WP library for this job, but it is
 * DOM-coupled — its Node path dereferences `document`, killing Astro SSR —
 * so the decode uses `entities`' decodeHTML: the same WHATWG named-entity
 * table that library obtains from the browser textarea trick, isomorphically.
 */
const wpText = (schema: z.ZodString) => schema.transform((value) => decodeHTML(value));

export const imageSchema = z.object({
  url: httpUrlSchema,
  alt: wpText(z.string()),
  width: id.nullable(),
  height: id.nullable(),
});
/**
 * The public profile route key shape: the headless registration path
 * generates UUID nicenames, so this is the only shape the frontend
 * route, its client assertion and the sitemap collector accept — every
 * consumer MUST use this one predicate or sitemap entries and links go
// dead for slugs outside it.
 */
export const PROFILE_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

export const authorSchema = z.object({
  id: count,
  /** Public profile route key (/profile/{slug}/); system-generated nicename. */
  slug: z.string(),
  name: wpText(z.string()),
  avatar: imageSchema.nullable(),
});
export const termSchema = z.object({
  id,
  // .catch: a future contract taxonomy degrades to the tag chip instead of
  // 503ing every term-consuming page until the frontend ships support.
  taxonomy: z.enum(['category', 'tag']).catch('tag'),
  slug: z.string().min(1),
  name: wpText(z.string()),
  description: wpText(z.string()),
  parentId: id.nullable(),
  count,
  /** Owning taxonomy's code name — a type may carry several tag vocabularies; group by this. */
  vocabulary: z.string().min(1),
  /** Free-form term meta text; the front end resolves it into an icon. */
  icon: z.string().nullable(),
  /** Term archive banner resolved from the media library. */
  cover: imageSchema.nullable(),
});

export const paginationSchema = z
  .object({
    page: id,
    perPage: id.max(100),
    totalItems: count,
    totalPages: count,
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  })
  .refine(
    (p) =>
      p.totalPages === Math.ceil(p.totalItems / p.perPage) &&
      p.hasNext === p.page < p.totalPages &&
      p.hasPrevious === p.page > 1,
    'Inconsistent pagination',
  );

// ---------------------------------------------------------------------------
// Envelope (`Api/Rest/Envelope.php`, applied centrally on rest_post_dispatch)
// ---------------------------------------------------------------------------

export const envelopeMetaSchema = z.object({
  apiVersion: z.literal(apiVersion),
  requestId: z.string().min(1),
});
export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string().min(1), message: z.string(), status: z.number().int() }),
  meta: envelopeMetaSchema,
});

const itemEnvelope = <T extends z.ZodType>(data: T) => z.object({ data, meta: envelopeMetaSchema });
const listEnvelope = <T extends z.ZodType>(item: T) =>
  itemEnvelope(z.array(item)).extend({
    meta: envelopeMetaSchema.extend({ pagination: paginationSchema }),
  });

// ---------------------------------------------------------------------------
// Content (posts / resources / pages share one projection; PostPresenter.php)
// ---------------------------------------------------------------------------

/** Rating pair is null for unrated items and types outside the rating scope. */
export const postMetricsSchema = z.object({
  views: count,
  likes: count,
  comments: count,
  ratingScore: count.nullable(),
  ratingCount: count.nullable(),
});
export const postSummarySchema = z.object({
  id,
  slug: z.string().min(1),
  /** Vocabularies whose front-end routes exist; `page` joined with the
      /pages/{slug}/ route (shared projection with posts). */
  type: z.enum(['post', 'resource', 'page']),
  /** WP allows publishing an untitled item; the snapshot's plain string is the contract. */
  title: wpText(z.string()),
  excerpt: wpText(z.string()),
  publishedAt: isoSchema,
  updatedAt: isoSchema,
  readingMinutes: count,
  thumbnail: imageSchema.nullable(),
  author: authorSchema,
  categories: z.array(termSchema),
  tags: z.array(termSchema),
  metrics: postMetricsSchema,
  /** Display-state keys: `sticky`, `password`, `private`, plus the visibility gates `login`/`member` — the front end owns copy and styling. */
  badges: z.array(z.enum(['sticky', 'password', 'private', 'login', 'member'])),
});
export const breadcrumbSchema = z.object({
  label: wpText(z.string()),
});
export const seoSchema = z.object({
  title: wpText(z.string()),
  description: wpText(z.string()),
  noindex: z.boolean(),
});
export const postDetailSchema = postSummarySchema.extend({
  /** True when the body is behind the password gate (empty content block). */
  locked: z.boolean(),
  /** The post's configured visibility gate: `public`, `login` or `member`. */
  visibility: z.enum(['public', 'login', 'member']),
  /** True when THIS viewer does not qualify past the gate (empty content block). */
  gated: z.boolean(),
  /** Per-post discussion switch (`comments_open`); false renders the section disabled. */
  commentsOpen: z.boolean(),
  /** True when the editor wrote a manual excerpt (vs the auto-generated summary text). */
  hasManualExcerpt: z.boolean(),
  content: z.object({ format: z.literal('html'), html: z.string() }),
  featured: imageSchema.nullable(),
  seo: seoSchema,
  breadcrumbs: z.array(breadcrumbSchema),
  previous: postSummarySchema.nullable(),
  next: postSummarySchema.nullable(),
  /** The logged-in viewer's own interaction state; guests read constant
      false/false/null (logged-in detail reads are never shared-cached). */
  viewerLiked: z.boolean(),
  viewerFavorited: z.boolean(),
  /** The viewer's own 1-10 rating vote within the dedupe window; null when
      unrated. */
  viewerRating: z.number().int().min(1).max(10).nullable(),
});

/** Brand color from the Frontend settings page; drives the whole palette. */
export const siteThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const siteDefaultsSchema = z.object({
  colorMode: z.enum(['system', 'dark', 'light']).catch('system'),
  /** Site fallback cover: list card thumbnails, category cards and the
      article hero, each surface deriving its own crop from this image. */
  thumb: imageSchema.nullable(),
  /** Placeholder for empty lists and error cards (0.44.0). */
  emptyImage: imageSchema.nullable(),
  theme: siteThemeSchema,
  /** Site-level SEO head values; empty = not configured. */
  seoKeywords: wpText(z.string()),
  seoDescription: wpText(z.string()),
  /** Google Analytics measurement id; the front end renders the snippet. */
  gaId: z.string(),
});
/** One compliance link row from the footer repeater. The URL is authored in
    the admin, so it is a path or an external URL like every other link row. */
export const beianLinkSchema = z.object({
  label: wpText(z.string()),
  url: linkTargetSchema,
  icon: z.enum(['shield', 'police', 'custom']).catch('shield'),
  iconUrl: z.string(),
});
/** Compliance footer; hitokoto switches the front end's random sign-off. */
export const siteFooterSchema = z.object({
  links: z.array(beianLinkSchema),
  hitokoto: z.boolean(),
});
/** WP discussion settings carried in the /site payload (comment form +
    pagination UI inputs). Login-only posting is structural, so
    commentRegistration is not projected. */
export const siteCommentsSchema = z.object({
  requireNameEmail: z.boolean(),
  commentMaxLinks: count,
  moderation: z.boolean(),
  previouslyApproved: z.boolean(),
  threadComments: z.boolean(),
  threadCommentsDepth: count,
  pageComments: z.boolean(),
  commentsPerPage: count,
  defaultCommentsPage: z.enum(['newest', 'oldest']).catch('newest'),
  commentOrder: z.enum(['asc', 'desc']).catch('desc'),
  /** "Users must be logged in to comment"; false lets guests use the native name/email composer. */
  commentRegistration: z.boolean(),
});

/** One smilies token of a pack: the literal `::code::` body plus the image
    the backend inlines for HTML content (0.62.0). */
export const smiliesItemSchema = z.object({
  code: z.string(),
  url: httpUrlSchema,
});
/** One smilies pack (= one directory under WP `wp-content/aiya_smilies/`). */
export const smiliesPackSchema = z.object({
  slug: z.string(),
  items: z.array(smiliesItemSchema),
});

export const menuItemSchema: z.ZodType<MenuItem> = z.object({
  id,
  label: wpText(z.string().min(1)),
  url: linkTargetSchema,
  target: z.enum(['self', 'blank']).catch('self'),
  /** Optional Lucide icon name from the primary-menu repeater. */
  icon: z.string().nullable(),
  children: z.array(z.lazy(() => menuItemSchema)),
});
export interface MenuItem {
  id: number;
  label: string;
  url: string;
  target: 'self' | 'blank';
  icon: string | null;
  children: MenuItem[];
}

/** One advertisement slot (page-top / page-bottom lists): click target,
    link text (also the banner alt) and the banner artwork. */
export const adSlotSchema = z.object({
  url: linkTargetSchema,
  label: wpText(z.string()),
  image: imageSchema,
});
export type AdSlot = z.infer<typeof adSlotSchema>;
/** One homepage section template (Blocks settings repeater): a heading
    row (Lucide icon + title, "more" link at the right) over a list of
    `count` posts the front end fetches itself. `categories` are slugs —
    empty means every category of the type; `moreUrl` is an explicit
    override, empty derives the type's archive path. */
export const homeSectionSchema = z.object({
  id: count,
  title: wpText(z.string().min(1)),
  // .catch: a section type the frontend cannot load yet degrades to the
  // post loop instead of taking the whole /site payload (and site) down.
  type: z.enum(['post', 'resource']).catch('post'),
  categories: z.array(z.string()),
  count: z.number().int().min(1).max(100),
  icon: z.string().nullable(),
  /** Empty means "derive the type's archive path" — not a link target. */
  moreUrl: z.union([linkTargetSchema, z.literal('')]),
});
export type HomeSection = z.infer<typeof homeSectionSchema>;
/** The shell's dynamic blocks: navigation menus + ad slots + the home
    section templates. */
export const siteBlocksSchema = z.object({
  primary: z.array(menuItemSchema),
  secondary: z.array(menuItemSchema),
  adsTop: z.array(adSlotSchema),
  adsBottom: z.array(adSlotSchema),
  sections: z.array(homeSectionSchema),
});

export const siteSchema = z.object({
  name: wpText(z.string().min(1)),
  description: wpText(z.string()),
  language: z.string(),
  timezone: z.string(),
  /** Mirrors the WP site icon (Settings > General). */
  favicon: imageSchema.nullable(),
  /** Header banner from the Frontend settings page; null unless the
      banner switch is on with a usable attachment (0.42.0). */
  banner: imageSchema.nullable(),
  /** Mirrors the WP membership setting (users_can_register): whether the
      front end should offer sign-up. */
  registrationOpen: z.boolean(),
  /** WP discussion settings (Settings > Discussion mirror). */
  comments: siteCommentsSchema,
  /** Shell config from the backend Frontend settings page (0.29.0): default
      color mode for the (future) theme system and the fallback thumbnail. */
  defaults: siteDefaultsSchema,
  footer: siteFooterSchema,
  /** The shell's dynamic slots from the backend Blocks settings page
      (0.83.0; the /menus/* reads folded in here). */
  blocks: siteBlocksSchema,
});
export const menuSchema = z.object({
  location: z.enum(['primary', 'secondary']),
  items: z.array(menuItemSchema),
});

// ---------------------------------------------------------------------------
// Discussion threads (Domain/Discussion, 0.26.0 thread form)
// ---------------------------------------------------------------------------

export const discussionStatusSchema = z.enum(['open', 'closed']);

/** Discussion board (板块): the routing unit that replaced the type vocabulary. */
export const discussionBoardSchema = z.object({
  id,
  slug: z.string().min(1),
  name: wpText(z.string().min(1)),
  description: wpText(z.string()),
  threads: count,
});

/**
 * Thread-embedded images: URLs mirror whatever the composer stored
 * (/media/ proxy paths included) and dimensions may be absent (0).
 * Deliberately looser than the backend's `list<Image>` docblock (which
 * promises absolute http URLs): the backend DiscussionPresenter currently
 * emits relative /media/ paths with 0 width/height, and this schema
 * tolerates that divergence until the presenter is normalized — the strict
 * imageSchema would fail every discussion payload. Contract snapshots only
 * pin type labels, so this drift is documented here, not enforced.
 */
export const discussionImageSchema = imageSchema.extend({
  url: z.string().min(1),
  width: z.number().int().min(0).nullable(),
  height: z.number().int().min(0).nullable(),
});
export const discussionSchema = z.object({
  id,
  /** May be empty for content-only threads; cards fall back to a text excerpt. */
  title: wpText(z.string()),
  board: discussionBoardSchema.nullable(),
  status: discussionStatusSchema,
  author: authorSchema,
  /** Flat reply count maintained by the backend; the only interaction metric. */
  replies: count,
  /** #tags extracted from the thread content. */
  tags: z.array(z.string()),
  /** <img> elements extracted from the thread content. Composer uploads
      store frontend-proxied /media/ paths, so the url is any non-empty
      string (unlike the strict absolute-URL post thumbnails), and width /
      height are 0 when the source tag declared no dimensions — the front
      end sizes the grid. */
  images: z.array(discussionImageSchema),
  lastReplyAt: isoOrEmptySchema,
  publishedAt: isoOrEmptySchema,
  /** Server-derived (author or edit_pages admin); the front end never re-implements the rules. */
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canReply: z.boolean(),
  /** Raw thread HTML (list projection carries it for the inline feed). */
  contentHtml: z.string(),
});
export const discussionReplySchema = z.object({
  id,
  author: authorSchema,
  /** Backend-rendered HTML (smilies become `img.aiya-smilie`); sanitize with the discussion filter before rendering. */
  content: z.string(),
  images: z.array(discussionImageSchema),
  publishedAt: isoOrEmptySchema,
  canDelete: z.boolean(),
});
export const discussionDetailSchema = discussionSchema.extend({
  /** array_merge overwrites the thread's reply count with the reply list. */
  replies: z.array(discussionReplySchema),
  /** Same content block as the posts projection; re-sanitized before render. */
  content: z.object({ format: z.literal('html'), html: z.string() }),
});

// ---------------------------------------------------------------------------
// File downloads (Domain/FileServe, 2026-09-21)
// ---------------------------------------------------------------------------

export const fileEntrySchema = z.object({
  /** Opaque reference to one row; a claim quotes it back. */
  ref: z.string().min(1),
  name: wpText(z.string().min(1)),
  /** file | dir — a folder carries no link at all. */
  kind: z.enum(['file', 'dir']),
  size: count,
  /** Icon category (pdf, archive, folder, …) decided by the backend. */
  type: z.string(),
  /** ISO 8601 in site time; null when the source reports no stamp. */
  modified: isoSchema.nullable(),
});

export const fileListSchema = z.object({
  /** The group's short id, which a claim names along with the row ref. */
  id: z.string().min(1),
  /** Which adapter produced this list (platform, openlist_list, …). */
  adapter: z.string().min(1),
  /** Caption above the list; `''` falls back to a generic label. */
  title: wpText(z.string()),
  /** Credits charged per file of this list; 0 = free. */
  price: count,
  items: z.array(fileEntrySchema),
});

export const downloadsSchema = z.object({
  /** One entry per data group, in the order the post configures them. */
  lists: z.array(fileListSchema),
});

export const downloadRequestSchema = z.object({
  listId: z.string().min(1),
  ref: z.string().min(1),
});

export const fileDownloadSchema = z.object({
  url: httpUrlSchema,
  /** The drive's own extraction code, handed over beside the link. */
  code: z.string().nullable(),
  /** What this delivery was charged. */
  price: count,
  /** The balance the charge left behind; null when nothing was charged. */
  balance: count.nullable(),
});

// ---------------------------------------------------------------------------
// Notifications (Domain/Notification, 0.23.0; read state lives client-side)
// ---------------------------------------------------------------------------

export const notificationSchema = z.object({
  id,
  /** One of the action-system kinds (announcement, post_commented, …);
      titles carry the copy, so the front end never branches on it. */
  type: z.string(),
  title: wpText(z.string()),
  body: wpText(z.string()),
  createdAt: isoOrEmptySchema,
});
export const notificationsResponseSchema = listEnvelope(notificationSchema);

// ---------------------------------------------------------------------------
// Comments (Api/Rest/CommentsController; classic wp_new_comment pipeline)
// ---------------------------------------------------------------------------

export const commentAuthorSchema = z.object({
  /** 0 for guests. */
  id: count,
  name: wpText(z.string()),
  /** Raw avatar URL (or null); deliberately not the Image shape. */
  avatar: z.string().nullable(),
});
export const commentSchema = z.object({
  id,
  parentId: id.nullable(),
  author: commentAuthorSchema,
  body: wpText(z.string()),
  /** Whitelisted comment HTML with backend-injected smilies imgs;
      render through `sanitizeCommentHtml`, never raw. */
  bodyHtml: z.string(),
  publishedAt: isoOrEmptySchema,
});
export const commentCreatedSchema = z.object({
  created: z.literal(true),
  id,
  /** `held` = awaiting moderation; the UI must say so instead of vanishing. */
  status: z.enum(['approved', 'held']),
});
/** The processed image facts of one community upload (post image-processor). */
export const uploadedImageSchema = z.object({
  width: count,
  height: count,
  mime: z.string(),
  title: wpText(z.string()),
});
export const uploadResultSchema = z.object({
  image: uploadedImageSchema,
  /** WP-absolute at the API edge; the /api proxy cloaks it to /media/. */
  url: httpUrlSchema,
  path: z.string(),
});

// ---------------------------------------------------------------------------
// User / auth (Domain/Identity, Api/Rest/AuthController + UserController)
// ---------------------------------------------------------------------------

export const avatarImageSchema = z.object({
  url: z.string(),
  thumbUrl: z.string(),
});
/** Owner-facing counters (posts / favorited / followers). */
export const profileStatsSchema = z.object({
  favorites: count,
  contributions: count,
  followers: count,
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;
export const userSchema = z.object({
  id,
  /** Server-generated UUID login name; never chosen, never displayed. */
  username: z.string().min(1),
  /** Public profile route key (/profile/{slug}/); system-generated nicename. */
  slug: z.string().min(1),
  nickname: wpText(z.string().min(1)),
  email: z.email(),
  url: z.string(),
  description: wpText(z.string()),
  /** WP locale string; the i18n layer normalizes it into the supported set. */
  locale: z.string(),
  registeredAt: isoOrEmptySchema,
  role: z.enum(['administrator', 'author', 'sponsor', 'subscriber']),
  /** Account-level disable switch; rides beside the role, never replaces a level. */
  banned: z.boolean(),
  /** "Always show NSFW content" (0.96.0): when true the backend ignores
      every NSFW exclusion for this account, overriding the per-browser
      soft switch the front end keeps. */
  showNsfw: z.boolean(),
  avatar: avatarImageSchema,
  /** Owner-facing profile counters (posts / favorited / followers). */
  stats: profileStatsSchema.nullable(),
});
export const authSessionSchema = z.object({
  token: z.string().min(16),
  /** Unix seconds. */
  expiresAt: count,
  user: userSchema,
});

// ---------------------------------------------------------------------------
// Profile (`/profiles/{slug}`; ProfilePresenter.php)
// ---------------------------------------------------------------------------

/** Membership badge = state + expiry only; the wording is this app's i18n. */
export const membershipBadgeSchema = z.object({
  status: z.enum(['active', 'inactive']).catch('inactive'),
  renewsAt: isoSchema.nullable(),
});
export const profileSchema = z.object({
  id,
  slug: z.string().min(1),
  name: wpText(z.string().min(1)),
  role: z.enum(['administrator', 'author', 'sponsor', 'subscriber']),
  avatar: imageSchema.nullable(),
  bio: wpText(z.string()),
  joinedAt: isoOrEmptySchema,
  stats: profileStatsSchema,
  membership: membershipBadgeSchema,
  favorites: z.array(postSummarySchema),
});

// ---------------------------------------------------------------------------
// Sponsorship / membership tiers (Domain/Sponsorship, 0.50.0 tier model)
// ---------------------------------------------------------------------------

export const tierSchema = z.object({
  key: z.string().min(1),
  name: wpText(z.string()),
  price: z.number().nonnegative(),
  cycleDays: z.number().int().min(1),
  creditsPerCycle: count,
  /** False = not purchasable; the front end drops it from buy lists. */
  enabled: z.boolean(),
  /** Fixed cycle count of one purchase; there is no front-end picker. */
  cycles: z.number().int().min(1),
  /** Plan-card blurb the membership settings page configures. */
  description: wpText(z.string()),
});
export const membershipEntitlementSchema = z.object({
  tierKey: z.string(),
  tierName: wpText(z.string()),
  cycleDays: z.number().int().min(1),
  creditsPerCycle: count,
  cyclesTotal: count,
  cyclesGranted: count,
  startsAt: isoSchema,
  endsAt: isoSchema,
  // .catch: an unknown future state must read as "not active" — the
  // entitlement gates treat only 'active' as live, so this is the safe side.
  status: z.enum(['active', 'cancelled']).catch('cancelled'),
});
/** The site's daily check-in policy (membership settings page), projected
    so the panel can describe the grant before taking it; the paid amount
    itself only ever comes from the grant response. */
export const checkinPolicySchema = z.object({
  enabled: z.boolean(),
  credits: count,
  validityDays: z.number().int().min(1),
});
/** The 0.50.0 tier-queue view replacing the old expiration payload. */
export const membershipStateSchema = z.object({
  active: z.boolean(),
  expiresAt: isoSchema.nullable(),
  nextGrantAt: isoSchema.nullable(),
  /** Derived credit balance, so the wallet needs no second request. */
  balance: count,
  queue: z.array(membershipEntitlementSchema),
  checkin: checkinPolicySchema,
});
export const orderCreatedSchema = z.object({
  orderId: z.string().min(1),
  submitUrl: httpUrlSchema,
});
export const planChannelsSchema = z.object({
  epay: z.boolean(),
  /** Platform-push gateway: activation rides webhooks, not the cashier. */
  afdian: z.boolean(),
  /** Enabled channels as a list; new gateways extend without reshaping.
      .catch([]): a gateway the frontend cannot render yet hides the epay
      channel row entirely — no buttons, no 503 — until support ships. */
  methods: z.array(z.enum(['alipay', 'wxpay', 'usdt'])).catch([]),
});
export const tiersPayloadSchema = z.object({
  channels: planChannelsSchema,
  items: z.array(tierSchema),
});

// ---------------------------------------------------------------------------
// Engagement counters (browser-direct, IP-deduplicated backend-side)
// ---------------------------------------------------------------------------

export const likeResultSchema = z.object({ likes: count, already: z.boolean() });
export const viewResultSchema = z.object({ views: count });
export const ratingResultSchema = z.object({ score: count, count: count, already: z.boolean() });

// ---------------------------------------------------------------------------
// Credits (Domain/Credit, 0.47.0; cost-accounting ledger — nothing is a
// permanent deposit, every grant bucket expires)
// ---------------------------------------------------------------------------

export const creditBalanceSchema = z.object({
  /** Derived from open ledger buckets; never cached client-side. */
  balance: count,
});
export const creditEntrySchema = z.object({
  id,
  /** `in` = grant bucket (remaining tracks what is left), `out` = one spend.
      .catch('out'): an unknown future direction must not inflate the ledger
      display; conservative side shows it as a spend. */
  direction: z.enum(['in', 'out']).catch('out'),
  source: z.string(),
  ref: z.string(),
  amount: count,
  remaining: count,
  createdAt: isoOrEmptySchema,
  expiresAt: isoSchema.nullable(),
});
export const creditGrantSchema = z.object({
  granted: count,
  balance: count,
  /** Expiry of the freshly created bucket (check-in grant or code redeem). */
  expiresAt: isoSchema,
});
/** Membership gift-code redemption: the tier queued, not a balance. */
export const membershipCodeGrantSchema = z.object({
  tierKey: z.string(),
  tierName: z.string(),
  cycles: count,
});
export const creditsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Optional — page size is the backend's call; only pass a number when a
      read wants its own size (same rule as postsQuerySchema.perPage). */
  perPage: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Response schemas (what client.ts validates against)
// ---------------------------------------------------------------------------

export const siteResponseSchema = itemEnvelope(siteSchema);
export const termsResponseSchema = itemEnvelope(z.array(termSchema));
/** Directory-scanned smilies packs (0.63.0, own read — kept off /site so
    hundreds of tokens do not ride every shell payload). */
export const smiliesResponseSchema = itemEnvelope(z.array(smiliesPackSchema));
export const postsResponseSchema = listEnvelope(postSummarySchema);
/** One content type's slice of the grouped search answer (page one of its
    relevance-ordered matches + the total for deep-linking into typed mode). */
export const searchGroupSchema = z.object({
  items: z.array(postSummarySchema),
  total: count,
});
/** Grouped cross-type answer served when /search receives no `type`. */
export const searchResultSchema = z.object({
  posts: searchGroupSchema,
  pages: searchGroupSchema,
  resources: searchGroupSchema,
});
/** Public content types `/search` can be scoped to. */
export const searchTypeSchema = z.enum(['post', 'page', 'resource']);
/** With `type` present the endpoint answers the standard list shape —
    reuse postsResponseSchema for that mode's parsing. */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: searchTypeSchema.optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(10),
  /** NSFW exclusion request; same semantics as postsQuerySchema. */
  excludeNsfw: z.boolean().optional(),
});
export const postResponseSchema = itemEnvelope(postDetailSchema);
export const resourcesResponseSchema = postsResponseSchema;
export const pagesResponseSchema = postsResponseSchema;
export const pageResponseSchema = postResponseSchema;
export const profileResponseSchema = itemEnvelope(profileSchema);
export const discussionsResponseSchema = listEnvelope(discussionSchema);
export const discussionResponseSchema = itemEnvelope(discussionDetailSchema);
export const discussionRepliesResponseSchema = listEnvelope(discussionReplySchema);
export const discussionReplyResponseSchema = itemEnvelope(discussionReplySchema);
export const discussionBoardsResponseSchema = itemEnvelope(z.array(discussionBoardSchema));
export const deletedResponseSchema = itemEnvelope(z.object({ deleted: z.literal(true) }));
export const downloadsResponseSchema = itemEnvelope(downloadsSchema);
export const fileDownloadResponseSchema = itemEnvelope(fileDownloadSchema);
export const commentsResponseSchema = listEnvelope(commentSchema);
export const commentCreatedResponseSchema = itemEnvelope(commentCreatedSchema);
export const meResponseSchema = itemEnvelope(userSchema);
export const followingResponseSchema = listEnvelope(authorSchema);
export const followStateSchema = itemEnvelope(z.object({ following: z.boolean() }));
export const authSessionResponseSchema = itemEnvelope(authSessionSchema);
export const doneResponseSchema = itemEnvelope(z.object({ done: z.literal(true) }));
export const sentResponseSchema = itemEnvelope(z.object({ sent: z.literal(true) }));
export const resetValidatedSchema = itemEnvelope(
  z.object({ valid: z.literal(true), login: z.string() }),
);
export const favoritesResponseSchema = listEnvelope(postSummarySchema);
export const favoritedResponseSchema = itemEnvelope(z.object({ favorited: z.boolean() }));
export const tiersResponseSchema = itemEnvelope(tiersPayloadSchema);
export const membershipResponseSchema = itemEnvelope(membershipStateSchema);
export const orderCreatedResponseSchema = itemEnvelope(orderCreatedSchema);
/** POST content/{id}/unlock: the verified post's full detail in the same response (cookie-less unlock). */
export const postUnlockResponseSchema = itemEnvelope(postDetailSchema);
/** GET content/{id}/related: shared-term neighbours as bare PostSummary rows. */
export const relatedResponseSchema = itemEnvelope(z.array(postSummarySchema));
export const afdianOrderUrlResponseSchema = itemEnvelope(z.object({ url: httpUrlSchema }));
export const likeResponseSchema = itemEnvelope(likeResultSchema);
export const viewResponseSchema = itemEnvelope(viewResultSchema);
export const ratingResponseSchema = itemEnvelope(ratingResultSchema);
export const creditBalanceResponseSchema = itemEnvelope(creditBalanceSchema);
export const creditEntriesResponseSchema = listEnvelope(creditEntrySchema);
export const creditCheckinResponseSchema = itemEnvelope(creditGrantSchema);
export const creditRedeemResponseSchema = itemEnvelope(membershipCodeGrantSchema);

// ---------------------------------------------------------------------------
// Query schemas (list filters; every value must survive URL round-trips)
// ---------------------------------------------------------------------------

export const postsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  /**
   * Deliberately has NO default: page size is the backend's call (it follows
   * the site's reading setting), so an unspecified perPage must stay absent
   * from the request rather than be invented here. Pass a number only when a
   * read wants its own size — the homepage window, the sitemap walk.
   */
  perPage: z.number().int().min(1).max(100).optional(),
  q: z.string().max(100).default(''),
  /** Comma-separated slug multi-select: any chosen term counts (backend IN). */
  category: z.string().max(200).default(''),
  /** Author nicename filter (public profile slug) for author archives. */
  author: z.string().max(100).default(''),
  /** Comma-separated tag slugs; any chosen tag in any vocabulary counts. */
  tag: z.string().max(200).default(''),
  sort: z.enum(['newest', 'oldest', 'rand']).default('newest'),
  /** NSFW exclusion request (0.96.0): rows carrying any backend-configured
      NSFW term drop out. Omitted = no exclusion (the backend's default);
      the client factory attaches it from the visitor's soft switch. */
  excludeNsfw: z.boolean().optional(),
});
export const resourcesQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Optional for the same reason as postsQuerySchema.perPage. */
  perPage: z.number().int().min(1).max(100).optional(),
  q: z.string().max(100).default(''),
  category: z.string().max(200).default(''),
  /** Comma-separated tag slugs; matches ANY of the resource type's five tag
      vocabularies. */
  tag: z.string().max(200).default(''),
  sort: z.enum(['newest', 'oldest', 'rand']).default('newest'),
  /** NSFW exclusion request; same semantics as postsQuerySchema. */
  excludeNsfw: z.boolean().optional(),
});
export const discussionsQuerySchema = z.object({
  board: z.string().max(50).default(''),
  status: z.enum(['', 'open', 'closed']).default(''),
  /** Keyword search over thread title and body; replies are not searched. */
  q: z.string().max(100).default(''),
  /** Closed-form #tag# filter matched against the thread body. */
  tag: z.string().max(50).default(''),
  post: z.number().int().min(0).default(0),
  user: z.number().int().min(0).default(0),
  sort: z.enum(['last_activity', 'newest']).default('last_activity'),
  page: z.number().int().min(1).default(1),
  /** Optional — page size is the backend's call (same rule as
      postsQuerySchema.perPage); only pass a number for a custom window. */
  perPage: z.number().int().min(1).max(100).optional(),
});
export const commentsQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Optional — the backend defaults follow the site's own discussion
      settings (comments_per_page / default_comments_page), and the detail
      pages pass them explicitly from the /site payload. */
  perPage: z.number().int().min(1).max(100).optional(),
  /** Display window direction; `desc` makes page 1 the newest window. */
  order: z.enum(['asc', 'desc']).optional(),
});
export const favoritesQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  /** Optional — page size is the backend's call (postsQuerySchema rule). */
  perPage: z.number().int().min(1).max(100).optional(),
});
export const termsQuerySchema = z.object({
  /** "all" flattens every vocabulary the type maps to the contract groups. */
  taxonomy: z.enum(['all', 'category', 'tag']).default('all'),
  type: z.enum(['post', 'page', 'resource']).default('post'),
  /** Withhold the NSFW-configured terms of the type (default false). */
  excludeNsfw: z.boolean().optional(),
  /** 0-count terms leave the published list by default; resolution reads
      (sitemap walkers, direct archive lookups) ask for the full set. */
  hideEmpty: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  remember: z.boolean(),
});
export const registerRequestSchema = z
  .object({
    nickname: z.string().min(1).max(50),
    email: z.email(),
    password: z.string().min(8).max(200),
    passwordConfirm: z.string(),
    /** Interface language, chosen on the form; lands on WP's per-user locale. */
    locale: z.enum(['zh_CN', 'zh_TW', 'zh_HK', 'en_US']).optional(),
  })
  .refine((input) => input.password === input.passwordConfirm, 'Passwords must match');
export const passwordResetRequestSchema = z.object({
  email: z.email(),
  /** Front-end self-declared origin; the backend allowlists scheme+host+port. */
  domain: z.string().optional(),
});
export const passwordResetValidateSchema = z.object({
  login: z.string().min(1),
  key: z.string().min(1),
});
export const passwordResetSchema = z
  .object({
    login: z.string().min(1),
    key: z.string().min(1),
    password: z.string().min(8).max(200),
    passwordConfirm: z.string(),
  })
  .refine((input) => input.password === input.passwordConfirm, 'Passwords must match');
export const profileUpdateSchema = z.object({
  nickname: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  url: z.string().optional(),
  email: z.email().optional(),
  locale: z.enum(['zh_CN', 'zh_TW', 'zh_HK', 'en_US']).optional(),
  /** "Always show NSFW content" (0.96.0); absent leaves the stored value. */
  showNsfw: z.boolean().optional(),
  /** Re-authentication credential: the backend refuses an email change
      without it (403 aiya_reauth_required). Absent for plain profile edits. */
  currentPassword: z.string().min(1).max(200).optional(),
});
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: z.string().min(8).max(200),
    passwordConfirm: z.string(),
  })
  .refine((input) => input.password === input.passwordConfirm, 'Passwords must match');
export const commentCreateSchema = z.object({
  authorName: z.string().max(245).optional(),
  authorEmail: z.email().optional(),
  /** Restricted HTML (kses-whitelisted server-side); the visible-text cap is enforced there. */
  body: z.string().min(1).max(20000),
  parentId: id.optional(),
});
export const discussionCreateSchema = z.object({
  /** Optional: an empty title renders as a content-only card. */
  title: z.string().max(191).default(''),
  board: z.string().max(50).default(''),
  content: z.string().min(1).max(20000),
  postId: z.number().int().min(0).default(0),
});
export const discussionUpdateSchema = z
  .object({
    title: z.string().min(1).max(191).optional(),
    content: z.string().min(1).max(20000).optional(),
    board: z.string().max(50).optional(),
    status: discussionStatusSchema.optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');
export const discussionReplyCreateSchema = z.object({
  content: z.string().min(1).max(10000),
});
export const discussionReplyUpdateSchema = z.object({
  content: z.string().min(1).max(10000),
});
export const redeemSchema = z.object({
  /** Site code ("redeem", default) or an Afdian order number ("afdian"). */
  channel: z.enum(['redeem', 'afdian']).default('redeem'),
  code: z.string().min(1).max(64),
});
export const orderCreateSchema = z.object({
  tierKey: z.string().min(1).max(32),
  channel: z.enum(['alipay', 'wxpay', 'usdt']),
  /** Where the payer's browser lands after paying; the front end derives it
      from its own origin (the page that initiated the checkout). The cycle
      count is the tier's own configuration, not a buyer choice. */
  returnUrl: httpUrlSchema.optional(),
});
export const favoriteCreateSchema = z.object({ postId: id });

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type EnvelopeMeta = z.infer<typeof envelopeMetaSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Image = z.infer<typeof imageSchema>;
export type Author = z.infer<typeof authorSchema>;
export type Term = z.infer<typeof termSchema>;
export type Site = z.infer<typeof siteSchema>;
export type SiteComments = z.infer<typeof siteCommentsSchema>;
export type Menu = z.infer<typeof menuSchema>;
export type PostSummary = z.infer<typeof postSummarySchema>;
export type PostDetail = z.infer<typeof postDetailSchema>;
export type SearchType = z.infer<typeof searchTypeSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchGroup = z.infer<typeof searchGroupSchema>;
export type Breadcrumb = z.infer<typeof breadcrumbSchema>;
export type DiscussionBoard = z.infer<typeof discussionBoardSchema>;
export type DiscussionStatus = z.infer<typeof discussionStatusSchema>;
export type Discussion = z.infer<typeof discussionSchema>;
export type DiscussionReply = z.infer<typeof discussionReplySchema>;
export type DiscussionDetail = z.infer<typeof discussionDetailSchema>;
export type FileEntry = z.infer<typeof fileEntrySchema>;
export type FileList = z.infer<typeof fileListSchema>;
export type FileDownload = z.infer<typeof fileDownloadSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type AvatarImage = z.infer<typeof avatarImageSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type TiersPayload = z.infer<typeof tiersPayloadSchema>;
export type MembershipEntitlement = z.infer<typeof membershipEntitlementSchema>;
export type MembershipState = z.infer<typeof membershipStateSchema>;
export type PostsQuery = z.infer<typeof postsQuerySchema>;
export type ResourcesQuery = z.infer<typeof resourcesQuerySchema>;
export type DiscussionsQuery = z.infer<typeof discussionsQuerySchema>;
export type CommentsQuery = z.infer<typeof commentsQuerySchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type CommentCreate = z.infer<typeof commentCreateSchema>;
export type DiscussionCreate = z.infer<typeof discussionCreateSchema>;
export type DiscussionUpdate = z.infer<typeof discussionUpdateSchema>;
export type DiscussionReplyCreate = z.infer<typeof discussionReplyCreateSchema>;
export type DiscussionReplyUpdate = z.infer<typeof discussionReplyUpdateSchema>;
export type OrderCreate = z.infer<typeof orderCreateSchema>;
export type CreditBalance = z.infer<typeof creditBalanceSchema>;
export type CreditEntry = z.infer<typeof creditEntrySchema>;
export type CreditGrant = z.infer<typeof creditGrantSchema>;
export type MembershipCodeGrant = z.infer<typeof membershipCodeGrantSchema>;
export type CreditsQuery = z.infer<typeof creditsQuerySchema>;
