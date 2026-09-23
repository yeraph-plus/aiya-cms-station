import { describe, expect, it } from 'vitest';
import {
  creditBalanceSchema,
  creditEntrySchema,
  creditGrantSchema,
  membershipCodeGrantSchema,
  discussionsResponseSchema,
  errorEnvelopeSchema,
  paginationSchema,
  postSummarySchema,
  downloadsResponseSchema,
  fileDownloadResponseSchema,
  downloadRequestSchema,
  siteThemeSchema,
  userSchema,
  notificationsResponseSchema,
} from '@/lib/core/contracts';

const meta = { apiVersion: '1', requestId: 'abcd1234' };
const pagination = {
  page: 1,
  perPage: 12,
  totalItems: 2,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

const author = { id: 1, slug: 'zhan-zhang', name: '站长', avatar: null };
const summary = {
  id: 101,
  slug: 'hello-world',
  url: '/posts/101/',
  type: 'post',
  title: '你好世界',
  excerpt: '第一篇',
  publishedAt: '2026-09-09T10:00:00+08:00',
  updatedAt: '2026-09-09T10:00:00+08:00',
  readingMinutes: 3,
  thumbnail: null,
  author,
  categories: [],
  tags: [],
  metrics: { views: 5, likes: 1, comments: 0, ratingScore: null, ratingCount: null },
  badges: ['sticky'],
};

describe('post summary contract', () => {
  it('accepts the backend v1 shape', () => {
    expect(postSummarySchema.safeParse(summary).success).toBe(true);
  });

  it('rejects dead type vocabularies (tweet/issue)', () => {
    expect(postSummarySchema.safeParse({ ...summary, type: 'tweet' }).success).toBe(false);
    expect(postSummarySchema.safeParse({ ...summary, type: 'issue' }).success).toBe(false);
  });

  it('rejects non-ISO dates and unsafe paths', () => {
    expect(postSummarySchema.safeParse({ ...summary, publishedAt: '2026/09/09' }).success).toBe(
      false,
    );
    expect(postSummarySchema.safeParse({ ...summary, url: '/posts/../wp-admin/' }).success).toBe(
      false,
    );
  });
});

describe('pagination invariants', () => {
  it('accepts consistent counts', () => {
    expect(paginationSchema.safeParse(pagination).success).toBe(true);
  });

  it('rejects inconsistent hasNext/totalPages', () => {
    expect(paginationSchema.safeParse({ ...pagination, totalPages: 5 }).success).toBe(false);
    expect(paginationSchema.safeParse({ ...pagination, hasNext: true }).success).toBe(false);
  });
});

describe('discussion thread contract (0.26.0 form)', () => {
  const discussion = {
    id: 7,
    url: '/community/7/',
    title: '求帮助',
    board: { id: 3, slug: 'help', name: '求助', description: '', threads: 5 },
    status: 'open',
    author,
    tags: ['求助'],
    images: [],
    replies: 2,
    lastReplyAt: '2026-09-09T12:00:00+08:00',
    publishedAt: '2026-09-09T11:00:00+08:00',
    canEdit: false,
    canDelete: false,
    canReply: true,
    contentHtml: '<p>正文</p>',
  };
  const listResponse = { data: [discussion], meta: { ...meta, pagination } };

  it('accepts the thread shape and empty lastReplyAt', () => {
    expect(
      discussionsResponseSchema.safeParse({
        ...listResponse,
        data: [{ ...discussion, lastReplyAt: '' }],
      }).success,
    ).toBe(true);
  });

  it('rejects the legacy feed shape (no type/status) and dead vocabularies', () => {
    const legacy = {
      id: 7,
      url: '/community/7/',
      title: 'x',
      body: 'y',
      topic: 'sharing',
      images: [],
    };
    expect(
      discussionsResponseSchema.safeParse({ data: [legacy], meta: { ...meta, pagination } })
        .success,
    ).toBe(false);
    expect(
      discussionsResponseSchema.safeParse({
        ...listResponse,
        data: [{ ...discussion, status: 'done' }],
      }).success,
    ).toBe(false);
  });
});

describe('file download contract (grouped lists, links only on claim)', () => {
  const entry = {
    ref: '9f2ab7c41d0e5a86',
    name: 'pack.zip',
    kind: 'file',
    size: 1024,
    type: 'archive',
    modified: '2026-08-01T00:00:00+00:00',
  };
  const downloads = {
    lists: [
      {
        id: '1',
        adapter: 'openlist_list',
        title: '文档目录',
        price: 5,
        items: [entry],
      },
    ],
  };

  it('accepts one list per data group', () => {
    expect(downloadsResponseSchema.safeParse({ data: downloads, meta }).success).toBe(true);
  });

  it('accepts a free drive-share list whose row carries no link', () => {
    const parsed = downloadsResponseSchema.safeParse({
      meta,
      data: {
        lists: [
          {
            ...downloads.lists[0],
            id: '2',
            adapter: 'platform',
            title: '夸克网盘',
            price: 0,
            items: [{ ...entry, name: '夸克网盘', type: 'unknown', size: 0 }],
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a folder row, which carries no link of its own', () => {
    const parsed = downloadsResponseSchema.safeParse({
      meta,
      data: {
        lists: [
          {
            ...downloads.lists[0],
            items: [{ ...entry, name: 'opt', kind: 'dir', type: 'folder', size: 0 }],
          },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a row from no known kind of node', () => {
    expect(
      downloadsResponseSchema.safeParse({
        meta,
        data: { lists: [{ ...downloads.lists[0], items: [{ ...entry, kind: 'symlink' }] }] },
      }).success,
    ).toBe(false);
  });

  it('accepts a claim answer with its link, code and balance', () => {
    const parsed = fileDownloadResponseSchema.safeParse({
      meta,
      data: {
        url: 'https://files.example.com/d/docs/pack.zip?sign=abc',
        code: 'x7k2',
        price: 5,
        balance: 15,
      },
    });
    expect(parsed.success).toBe(true);

    // A free delivery reports no new balance, and no code when the source has none.
    expect(
      fileDownloadResponseSchema.safeParse({
        meta,
        data: { url: 'https://pan.quark.cn/s/abc', code: null, price: 0, balance: null },
      }).success,
    ).toBe(true);
  });

  it('rejects a claim for a row that is not addressed by list and ref', () => {
    expect(downloadRequestSchema.safeParse({ listId: '1', ref: entry.ref }).success).toBe(true);
    expect(downloadRequestSchema.safeParse({ listId: '', ref: entry.ref }).success).toBe(false);
    expect(downloadRequestSchema.safeParse({ ref: entry.ref }).success).toBe(false);
  });
});

describe('user and notification contracts', () => {
  it('keeps the legacy role vocabulary only', () => {
    const user = {
      id: 9,
      username: '0f5c2f3e-1111-4222-8333-444455556666',
      slug: '0f5c2f3e-1111-4222-8333-444455556666',
      nickname: '站友',
      email: 'u@example.com',
      url: '',
      description: '',
      locale: 'zh_CN',
      registeredAt: '2026-01-01T00:00:00+08:00',
      role: 'subscriber',
      banned: false,
      avatar: { url: '', thumbUrl: '' },
      stats: { favorites: 3, contributions: 1, followers: 0 },
    };
    expect(userSchema.safeParse(user).success).toBe(true);
    expect(userSchema.safeParse({ ...user, role: 'editor' }).success).toBe(false);
  });

  it('parses the notifications feed shape (top-level items + paginated meta)', () => {
    const notification = {
      id: 3,
      type: 'announcement',
      title: '公告',
      body: '内容',
      createdAt: '2026-09-01T08:00:00+08:00',
    };
    expect(
      notificationsResponseSchema.safeParse({
        items: [notification],
        meta: { ...meta, pagination },
      }).success,
    ).toBe(true);
    // The action system writes per-kind types; the front end never branches
    // on them, so any string parses.
    expect(
      notificationsResponseSchema.safeParse({
        items: [{ ...notification, type: 'comment_replied' }],
        meta: { ...meta, pagination },
      }).success,
    ).toBe(true);
  });
});

describe('error envelope', () => {
  it('parses the machine code and keeps the message out of scope for copy', () => {
    const parsed = errorEnvelopeSchema.safeParse({
      error: { code: 'aiya_rate_limited', message: 'Too many requests', status: 429 },
      meta,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects wrong api versions', () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: 'aiya_rate_limited', message: 'x', status: 429 },
        meta: { apiVersion: '2', requestId: 'abcd1234' },
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Authored click targets (shell blocks, 2026-09-19). The WordPress admin lets
// an operator type either a bare front-end path or an external URL, and the
// backend normalizer collapses same-site values to a path. An absolute-only
// schema here fails /site validation, which the middleware gate reads as
// "backend unreachable" — one relative ad URL took the whole site to 503.
// ---------------------------------------------------------------------------

describe('authored link targets accept both shapes', () => {
  const image = {
    url: 'http://localhost:8000/wp-content/uploads/x.jpg',
    alt: 'x',
    width: 4,
    height: 4,
  };

  it('accepts a site-relative path on ads and menu rows', () => {
    expect(adSlotSchema.safeParse({ url: '/promo/', label: '促销', image }).success).toBe(true);
    expect(
      menuItemSchema.safeParse({
        id: 1,
        label: '关于本站',
        url: '/pages/sample-page/',
        target: 'self',
        icon: null,
        children: [],
      }).success,
    ).toBe(true);
  });

  it('still accepts an external URL', () => {
    expect(
      adSlotSchema.safeParse({ url: 'https://ext.example/promo', label: '促销', image }).success,
    ).toBe(true);
  });

  it('still rejects unsafe paths and credentialed URLs', () => {
    for (const url of ['//evil.example/x', '/a/../../b', '/a%2fb', 'https://u:p@ext.example/x']) {
      expect(adSlotSchema.safeParse({ url, label: '促销', image }).success, url).toBe(false);
    }
  });

  it('accepts site-relative paths carrying a query string (backend normalizeUrl keeps it)', () => {
    for (const url of ['/posts/?category=tech', '/search/wp/?type=resource', '/promo/?x=1&y=2']) {
      expect(adSlotSchema.safeParse({ url, label: '促销', image }).success, url).toBe(true);
    }
    // Traversal must still be refused when it hides in the path segment.
    expect(adSlotSchema.safeParse({ url: '/a/../..?x=1', label: '促销', image }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Backend contract snapshot consistency (0.33.0): the JSON is generated by
// `wp aiya contracts snapshot` from aiya-core Api/Contract DTOs and
// committed as src/lib/core/contracts.snapshot.json. Regenerate + re-run
// whenever the backend contract changes.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  adSlotSchema,
  fileEntrySchema,
  fileListSchema,
  fileDownloadSchema,
  authSessionSchema,
  authorSchema,
  beianLinkSchema,
  avatarImageSchema,
  breadcrumbSchema,
  checkinPolicySchema,
  commentAuthorSchema,
  commentSchema,
  discussionBoardSchema,
  discussionDetailSchema,
  homeSectionSchema,
  discussionReplySchema,
  discussionSchema,
  imageSchema,
  membershipBadgeSchema,
  membershipEntitlementSchema,
  membershipStateSchema,
  menuItemSchema,
  notificationSchema,
  planChannelsSchema,
  postDetailSchema,
  postMetricsSchema,
  profileSchema,
  profileStatsSchema,
  searchGroupSchema,
  searchResultSchema,
  seoSchema,
  siteDefaultsSchema,
  siteFooterSchema,
  siteCommentsSchema,
  siteBlocksSchema,
  siteSchema,
  smiliesItemSchema,
  smiliesPackSchema,
  termSchema,
  tierSchema,
  tiersPayloadSchema,
  uploadedImageSchema,
  uploadResultSchema,
} from '@/lib/core/contracts';

type SnapshotProperty = { name: string; type: string; nullable: boolean };
type Snapshot = { contractVersion: string; dtos: Record<string, SnapshotProperty[]> };

const snapshot: Snapshot = JSON.parse(
  readFileSync(new URL('../src/lib/core/contracts.snapshot.json', import.meta.url), 'utf-8'),
);

const manifest: Record<string, z.ZodType> = {
  AdSlot: adSlotSchema,
  FileEntry: fileEntrySchema,
  FileList: fileListSchema,
  FileDownload: fileDownloadSchema,
  AuthSession: authSessionSchema,
  Author: authorSchema,
  BeianLink: beianLinkSchema,
  AvatarImage: avatarImageSchema,
  Breadcrumb: breadcrumbSchema,
  CheckinPolicy: checkinPolicySchema,
  Comment: commentSchema,
  CommentAuthor: commentAuthorSchema,
  CreditBalance: creditBalanceSchema,
  CreditEntry: creditEntrySchema,
  CreditGrant: creditGrantSchema,
  Discussion: discussionSchema,
  DiscussionBoard: discussionBoardSchema,
  DiscussionDetail: discussionDetailSchema,
  DiscussionReply: discussionReplySchema,
  HomeSection: homeSectionSchema,
  Image: imageSchema,
  Membership: membershipBadgeSchema,
  MembershipCodeGrant: membershipCodeGrantSchema,
  MembershipEntitlement: membershipEntitlementSchema,
  MembershipState: membershipStateSchema,
  MenuItem: menuItemSchema,
  Notification: notificationSchema,
  Pagination: paginationSchema,
  PlanChannels: planChannelsSchema,
  PostDetail: postDetailSchema,
  PostMetrics: postMetricsSchema,
  PostSummary: postSummarySchema,
  Profile: profileSchema,
  ProfileStats: profileStatsSchema,
  SearchGroup: searchGroupSchema,
  SearchResult: searchResultSchema,
  Seo: seoSchema,
  Site: siteSchema,
  SiteBlocks: siteBlocksSchema,
  SiteComments: siteCommentsSchema,
  SiteDefaults: siteDefaultsSchema,
  SiteFooter: siteFooterSchema,
  SiteTheme: siteThemeSchema,
  SmiliesItem: smiliesItemSchema,
  SmiliesPack: smiliesPackSchema,
  Term: termSchema,
  Tier: tierSchema,
  TiersPayload: tiersPayloadSchema,
  UploadedImage: uploadedImageSchema,
  UploadResult: uploadResultSchema,
  UserProfile: userSchema,
};

/** Strips nullable/optional/default wrappers and returns the inner type tag. */
function unwrapField(field: z.ZodType): { type: string; nullable: boolean } {
  let current = field;
  let nullable = false;
  while (
    current.def.type === 'nullable' ||
    current.def.type === 'optional' ||
    current.def.type === 'default'
  ) {
    if (current.def.type === 'nullable') nullable = true;
    current = (current.def as unknown as { innerType: z.ZodType }).innerType;
  }
  return { type: current.def.type, nullable };
}

const ALLOWED_TYPES: Record<string, string[]> = {
  string: ['string', 'enum', 'literal', 'union'],
  int: ['number', 'literal'],
  float: ['number'],
  bool: ['boolean'],
  array: ['array'],
  mixed: [
    'string',
    'enum',
    'literal',
    'number',
    'boolean',
    'object',
    'array',
    'union',
    'lazy',
    'record',
    'tuple',
    'date',
  ],
};

describe('backend contract snapshot', () => {
  const dtoNames = Object.keys(snapshot.dtos).sort();
  const manifestNames = Object.keys(manifest).sort();

  it('covers every backend DTO with a zod schema', () => {
    expect(dtoNames.filter((name) => !manifestNames.includes(name))).toEqual([]);
  });

  it('has no zod schemas without backend DTOs', () => {
    expect(manifestNames.filter((name) => !dtoNames.includes(name))).toEqual([]);
  });

  it.each(dtoNames)('%s mirrors the snapshot field set', (name) => {
    const properties = snapshot.dtos[name];
    const shape = (manifest[name] as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
    expect(Object.keys(shape).sort()).toEqual(properties.map((p) => p.name).sort());
  });

  it.each(dtoNames)('%s mirrors the snapshot field types', (name) => {
    const shape = (manifest[name] as unknown as z.ZodObject).shape as Record<string, z.ZodType>;
    for (const property of snapshot.dtos[name]) {
      const { type, nullable } = unwrapField(shape[property.name]);
      expect(nullable).toBe(property.nullable);
      const allowed = ALLOWED_TYPES[property.type] ?? ['object'];
      expect(allowed, `${name}.${property.name} (php: ${property.type})`).toContain(type);
    }
  });
});

// ---------------------------------------------------------------------------
// v1 contract lock (0.36.0): contracts.snapshot.v1.json is the frozen
// baseline. The living snapshot may only grow — every baseline DTO and
// field must survive with the same type and nullability forever.
// ---------------------------------------------------------------------------

const v1: Snapshot = JSON.parse(
  readFileSync(new URL('../src/lib/core/contracts.snapshot.v1.json', import.meta.url), 'utf-8'),
);

describe('v1 contract lock (additive-only)', () => {
  const liveNames = Object.keys(snapshot.dtos);

  it.each(Object.keys(v1.dtos).sort())('v1 DTO %s still exists', (name) => {
    expect(liveNames, `DTO ${name} was removed after the v1 lock`).toContain(name);
  });

  it('keeps every v1 field with its type and nullability', () => {
    const violations: string[] = [];
    for (const [name, properties] of Object.entries(v1.dtos)) {
      const live = snapshot.dtos[name];
      if (!live) {
        violations.push(`${name}: DTO removed`);
        continue;
      }
      const byName = new Map(live.map((p) => [p.name, p]));
      for (const property of properties) {
        const now = byName.get(property.name);
        if (!now) {
          violations.push(`${name}.${property.name}: field removed`);
          continue;
        }
        if (now.type !== property.type) {
          violations.push(`${name}.${property.name}: type ${property.type} -> ${now.type}`);
        }
        if (now.nullable !== property.nullable) {
          violations.push(
            `${name}.${property.name}: nullable ${property.nullable} -> ${now.nullable}`,
          );
        }
      }
    }
    expect(violations, 'v1 baseline violations').toEqual([]);
  });
});
