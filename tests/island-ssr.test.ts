import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UserCenter from '@/components/islands/UserCenter';
import PostLoop, { type LoopChip } from '@/components/islands/feed/PostLoop';
import { ChannelCard } from '@/components/islands/channels/ChannelFeed';
import type { PostSummary } from '@/lib/core/contracts';
import type { UserCenterCopy, UserCenterUser } from '@/components/islands/user-center/types';
import { groupChannelRows, type ChannelPost } from '@/lib/channels';
import { t } from '@/lib/i18n';

/**
 * Island SSR guard (2026-09-28 事故后的常驻执法): every island is rendered on
 * the server before it ever hydrates, so whatever the *render path* touches
 * must exist there. A `document.cookie` read inside a useState lazy
 * initializer looked harmless — the initializer runs under SSR too — and it
 * threw `document is not defined` mid-stream: the signed-in shell was cut
 * off right after the notification bell, so no page below the header and no
 * island script reached the browser ("all islands dead", live outage).
 *
 * Two rules follow. The session islands must actually render on the server
 * (nothing catches this today: no route renders a signed-in shell in CI),
 * and browser globals stay out of the render path — effects and event
 * handlers only. Reading visitor state during render is the shell's job; it
 * arrives as a prop (e.g. user.softNsfw from lib/nsfw.ts).
 */

const copy = t('zh_CN');
const shell = copy.shell;

function copyFixture(): UserCenterCopy {
  return {
    login: shell.login,
    register: shell.register,
    logout: shell.logout,
    profile: shell.profile,
    favorites: shell.favorites,
    followingTitle: copy.profile.followingTitle,
    wallet: copy.membership.walletLedgerLink,
    membership: copy.membership.sponsorTitle,
    accountSettings: copy.profile.accountSettings,
    chatSupport: shell.chatSupport,
    emailLabel: shell.emailLabel,
    passwordLabel: shell.passwordLabel,
    passwordConfirmLabel: shell.passwordConfirmLabel,
    nicknameLabel: shell.nicknameLabel,
    localeLabel: shell.localeLabel,
    authFailed: shell.authFailed,
    loginSuccess: shell.loginSuccess,
    registerSuccess: shell.registerSuccess,
    logoutSuccess: shell.logoutSuccess,
    forgotPassword: shell.forgotPassword,
    welcome: shell.welcome('SSR Probe'),
    remember: shell.remember,
    switchToRegisterHint: shell.switchToRegisterHint,
    switchToLoginHint: shell.switchToLoginHint,
    notifications: shell.notifications,
    notificationsLoading: shell.notificationsLoading,
    notificationsEmpty: shell.notificationsEmpty,
    notificationsError: shell.notificationsError,
    showNsfw: shell.showNsfw,
    showNsfwLocked: shell.showNsfwLocked,
    notificationsViewAll: shell.notificationsViewAll,
    notificationsLoadMore: shell.notificationsLoadMore,
  };
}

function sessionUser(showNsfw: boolean, softNsfw: boolean): UserCenterUser {
  return {
    nickname: 'SSR Probe',
    avatarUrl: null,
    roleLabel: shell.roleLabels.sponsor,
    slug: 'ssr-probe',
    email: 'ssr-probe@example.com',
    showNsfw,
    softNsfw,
  };
}

const locale = 'zh_CN' as const;

function renderUserCenter(user: UserCenterUser | null): string {
  return renderToString(
    createElement(UserCenter, {
      user,
      registrationOpen: true,
      localeTag: 'zh-CN',
      locale,
      timezone: 'Asia/Shanghai',
      copy: copyFixture(),
    }),
  );
}

describe('shell islands render on the server', () => {
  it('renders the signed-out entries for an anonymous visitor', () => {
    const html = renderUserCenter(null);
    expect(html).toContain(shell.login);
    expect(html).toContain(shell.register);
  });

  it('renders the signed-in menu across every switch combination', () => {
    // [hard switch (account meta), soft switch (cookie prop)]: the hard one
    // short-circuits the OR that used to read the cookie in render.
    for (const [hard, soft] of [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const) {
      expect(renderUserCenter(sessionUser(hard, soft))).toContain('SSR Probe');
    }
  });
});

/** The channel card is the album renderer: a caption that rides a later
    album row must still reach the server HTML (rows[0] alone dropped it). */
function channelPost(overrides: Partial<ChannelPost>): ChannelPost {
  return {
    id: 1,
    kind: 'photo',
    text: '',
    entities: [],
    media: [{ url: 'https://aiya.test/album.png', width: 800, height: 600 }],
    channel: { id: -1001234567890, title: 'Example', username: 'example', nsfw: false },
    tgLink: 'https://t.me/example/1',
    mediaGroupId: 'album',
    postedAt: '2026-10-13T00:00:00+00:00',
    ...overrides,
  };
}

describe('channel cards render on the server', () => {
  it('renders the caption of a later album row, not just the first row', () => {
    const group = groupChannelRows([
      channelPost({ id: 2 }),
      channelPost({ id: 1, text: '相册说明文字' }),
    ])[0]!;
    const html = renderToString(
      createElement(ChannelCard, {
        group,
        locale,
        timezone: 'Asia/Shanghai',
        showNsfw: false,
        onOpen: () => {},
        onTag: () => {},
      }),
    );
    expect(html).toContain('相册说明文字');
    expect(html).toContain('https://aiya.test/album.png');
    // The card stacks text above the media area: DOM order is visual order.
    expect(html.indexOf('相册说明文字')).toBeLessThan(html.indexOf('https://aiya.test/album.png'));
  });
});

/**
 * The category table never fits one toolbar row: PostLoop keeps the busiest
 * window in the row and hands the tail to the panel's category row (split at
 * lib/filters' CATEGORY_CHIP_CAP). The panel is closed at first paint, so the
 * tail must not reach the SSR HTML at all — and the chevron appears exactly
 * when there is a tail to reach.
 */
function loopChips(count: number): LoopChip[] {
  return [
    { slug: '', name: '全部', href: '/posts/' },
    ...Array.from({ length: count }, (_, index) => ({
      slug: `term-${index + 1}`,
      name: `分类 ${index + 1}`,
      // Descending counts: the ranking mirrors the fixture order, so where the
      // cut lands is unambiguous.
      count: 1000 - index,
      href: `/posts/?category=term-${index + 1}`,
    })),
  ];
}

/** The bare minimum a FeedCard reads: the tests below need a non-empty list
    so the append sentinel (and the pager) have something to speak about. */
function loopItem(id: number): PostSummary {
  return {
    id,
    type: 'post',
    slug: `probe-${id}`,
    title: `Probe ${id}`,
    excerpt: '',
    badges: [],
    categories: [],
    author: { name: '', avatar: null },
    metrics: { views: 0, likes: 0, comments: 0, ratingScore: null, ratingCount: null },
    thumbnail: null,
  } as unknown as PostSummary;
}

function renderLoop(
  chips: LoopChip[],
  options: { heading?: string; hasNext?: boolean } = {},
): string {
  return renderToString(
    createElement(PostLoop, {
      endpoint: '/api/feed/posts/',
      items: [loopItem(1)],
      pagination: { page: 1, totalPages: 3, hasNext: options.hasNext ?? true, hasPrevious: false },
      page: 1,
      query: {},
      route: { index: '/posts/', pagePattern: '/posts/page/{page}/', carry: ['category'] },
      chips,
      categoryLabel: '分类',
      heading: options.heading,
      emptyText: copy.posts.listEmpty,
      errorText: copy.state.backendMessage,
      locale,
    }),
  );
}

describe('the loop category window renders on the server', () => {
  it('keeps the tail out of the toolbar row and behind the chevron', () => {
    const html = renderLoop(loopChips(15));
    expect(html).toContain('分类 12');
    // Neither chip nor crawlable href for the three quietest terms.
    expect(html).not.toContain('分类 13');
    expect(html).not.toContain('term-13');
    // The tail is what justifies the filter chevron on a chips-only list.
    expect(html).toContain(copy.posts.filter);
  });

  it('drops the chevron when the whole table fits the row', () => {
    const html = renderLoop(loopChips(12));
    expect(html).toContain('分类 12');
    expect(html).not.toContain(copy.posts.filter);
  });
});

/**
 * The navigation mode is derived from the toolbar, never passed per route: a
 * filter bar means the visitor is scrolling a stream (append sentinel, no
 * pager), anything else means explicit pages. Both halves are asserted, so a
 * mode that silently disappears cannot pass as the other one.
 */
describe('the loop mode follows the toolbar', () => {
  it('appends the next page while the filter bar owns the toolbar', () => {
    const html = renderLoop(loopChips(15), { hasNext: false });
    expect(html).toContain(copy.posts.noMore);
    expect(html).not.toContain(copy.common.pagination);
  });

  it('renders the pager buttons for a heading-only list', () => {
    const html = renderLoop([], { heading: copy.posts.title });
    expect(html).toContain(copy.common.pagination);
    expect(html).not.toContain(copy.posts.noMore);
  });
});

/**
 * Static nets for the same mistake, scanned over the island sources AND the
 * shadcn ui/ parts (the Toaster in ui/sonner reads `document` in its render
 * path — legally, behind a `typeof` guard — which is exactly the kind of
 * thing the islands-only walk could not see). The render test above is the
 * reliable one — these are heuristics with a named escape hatch: an island
 * that needs browser state must be handed it as a prop (shells resolve
 * cookies server-side, e.g. user.softNsfw), because islands never render on
 * the client alone.
 *
 *  1. No cookie reads in a component at all. The outage read sat in a helper
 *     called from a useState initializer, so a rule that only looked at the
 *     initializer itself missed it; cookies are server state and the shell
 *     is the one place that reads them (lib/nsfw.ts).
 *  2. No browser global written straight into a lazy useState initializer —
 *     a regex cannot follow a helper call, hence rule 1.
 */
const COOKIE_READ = /document\.cookie(?!\s*[+]?=)/;
const LAZY_INITIALIZER_WITH_BROWSER_GLOBAL =
  /useState\s*(?:<[^<>]*>)?\s*\(\s*\(\s*\)\s*=>[^;]{0,300}?\b(document|window|localStorage|sessionStorage)\s*\./;

const ROOT = join(import.meta.dirname, '..');
const ISLANDS = join(ROOT, 'src/components/islands');
const UI_PARTS = join(ROOT, 'src/components/ui');

/** Comments (including this file's own prose about cookies) must not trip a
    scan that greps source text. Only whole comment lines are dropped, so a
    `://` inside a URL string cannot swallow live code. */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function componentSources(): Array<[string, string]> {
  return [...walk(ISLANDS), ...walk(UI_PARTS)].map((file) => [
    relative(ROOT, file).split(sep).join('/'),
    withoutComments(readFileSync(file, 'utf-8')),
  ]);
}

describe('islands and ui parts keep browser state out of the render path', () => {
  it('never reads a cookie (the shell resolves it and passes a prop)', () => {
    const hits = componentSources()
      .filter(([, text]) => COOKIE_READ.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it('never sniffs the environment in a component (SSR throws; locales ride props)', () => {
    // The 2026-09-28 outage shape: `localeTag || navigator.language` is a
    // hydration/SSR crash the moment one caller passes an empty string.
    // The rule targets environment reads (locale/agent/geolocation), not
    // API calls like navigator.clipboard inside event handlers. History:
    // the pre-2026-10-03 regex carried a stray literal backspace and never
    // matched anything — a silently dead guard this rewrite revived.
    const hits = componentSources()
      .filter(([, text]) =>
        /navigator\s*\.\s*(languages?|userAgent|platform|geolocation)\b/.test(text),
      )
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it('never reaches a browser global from a useState lazy initializer', () => {
    const hits = componentSources()
      .filter(([, text]) => LAZY_INITIALIZER_WITH_BROWSER_GLOBAL.test(text))
      .map(([file]) => file);
    expect(hits).toEqual([]);
  });
});
