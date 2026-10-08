import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import UserCenter from '@/components/islands/UserCenter';
import type { UserCenterCopy, UserCenterUser } from '@/components/islands/user-center/types';
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
