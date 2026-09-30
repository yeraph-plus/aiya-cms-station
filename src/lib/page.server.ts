import type { AstroCookies } from 'astro';
import type { AiyaClient } from './core/client';
import type { Menu, Site, User } from './core/contracts';
import { backend } from './core/health';
import { currentUser, readSessionToken } from './core/session';
import { authClient, serverClient, siteOrigin } from './core/server';
import { nsfwExcluded } from './nsfw';
import { resolveLocale, t } from './i18n';
import { pageError, type PageErrorCopy } from './page-error';
import { isBackendOutage } from './reachability';

export type Locale = ReturnType<typeof resolveLocale>;
export interface ShellFrame {
  site: Site;
  /** This site's own origin (AIYA_SITE_URL, validated): canonical, og:url
      and JSON-LD ride on it. Resolved inside loadPage so a misconfigured
      URL fails closed (degraded 503 page) instead of silently emitting
      localhost canonicals that would pull the site out of the index. */
  origin: string;
  menu: Menu;
  /** Secondary menu group — rendered as the footer navigation. */
  footerMenu: Menu;
  /** Signed-in visitor or null; any session failure degrades to guest. */
  user: User | null;
  locale: Locale;
  /**
   * True when the shell itself failed and hardcoded chrome is showing. The
   * middleware gate catches a backend that is already known to be down, so
   * this only fires when the backend died between the gate's probe and this
   * fetch — a race the page must survive rather than a normal state.
   */
  degraded: boolean;
}

export type PageResult<T = unknown> = ShellFrame &
  ({ ok: true; value: T } | { ok: false; error: PageErrorCopy });

/** Hardcoded chrome for the case nothing could be fetched mid-flight. */
const fallbackSite: Site = {
  name: 'AIYA',
  description: '记录、整理与分享。',
  language: 'zh_CN',
  timezone: 'Asia/Shanghai',
  favicon: null,
  banner: null,
  registrationOpen: false,
  defaults: {
    colorMode: 'system',
    thumb: null,
    emptyImage: null,
    theme: { primary: '#e94f69' },
    seoKeywords: '',
    seoDescription: '',
    gaId: '',
  },
  footer: { links: [], hitokoto: false },
  comments: {
    requireNameEmail: true,
    commentMaxLinks: 0,
    moderation: true,
    previouslyApproved: true,
    threadComments: true,
    threadCommentsDepth: 3,
    pageComments: true,
    commentsPerPage: 20,
    defaultCommentsPage: 'newest',
    commentOrder: 'desc',
    commentRegistration: true,
  },
  blocks: {
    primary: [
      { id: 1, label: '发现', url: '/', target: 'self', icon: null, children: [] },
      { id: 2, label: '资源库', url: '/resources/', target: 'self', icon: null, children: [] },
      { id: 3, label: '讨论', url: '/community/', target: 'self', icon: null, children: [] },
      { id: 4, label: '文章', url: '/posts/', target: 'self', icon: null, children: [] },
    ],
    secondary: [],
    adsTop: [],
    adsBottom: [],
    sections: [],
  },
};

/**
 * The one page assembler: fetches the shell frame (site, menu, session) in
 * parallel, resolves the locale, then runs the page's own resource. A
 * failed resource renders with the intact shell; a failed shell renders
 * with hardcoded chrome and noindex. Importing server.ts pins this module
 * to the Astro server.
 *
 * A backend that is *known* down never reaches here — the middleware gate
 * answers those requests. This runs only once the gate has seen a live
 * backend, so a failure here is a mid-flight outage.
 */
export async function loadPage<T>(
  resource: (
    client: AiyaClient,
    site: Site,
    /** The visitor's NSFW soft state: true when the content reads this page
        renders must carry the backend exclusion flag (lib/nsfw.ts). */
    ctx: { excludeNsfw: boolean },
  ) => Promise<T>,
  cookies: AstroCookies,
  // Resolved by the middleware (App.locals.visitorIp): every SSR read rides
  // the proxy bridge with the real visitor address, or the backend's rate
  // limiting and guest dedup collapse this whole site into one REMOTE_ADDR.
  clientIp?: string | null,
): Promise<PageResult<T>> {
  try {
    // Configuration first: without a usable own origin the site must not
    // render (every canonical would point at the fallback host).
    const origin = siteOrigin();
    // A valid session cookie upgrades the whole page read to the visitor's
    // own bearer: /users/me* resources (profile hub, settings) need it, and
    // public reads simply stay public. No token → anonymous client.
    const token = readSessionToken(cookies);
    // The NSFW soft switch rides the same factory as the list reads: the
    // factory flag merges into every list query the resource issues. The
    // hard switch (user meta) is enforced by the backend itself, so the
    // flag may ride even for a hard-switch user — it is ignored there.
    const excludeNsfw = nsfwExcluded(cookies);
    const client = token
      ? authClient(token, clientIp, excludeNsfw)
      : serverClient(clientIp, excludeNsfw);
    const [siteResult, user] = await Promise.all([client.site(), currentUser(cookies, clientIp)]);
    const site = siteResult.data;
    // The shell's dynamic blocks ride the /site payload (0.83.0 merge):
    // the menu consumers keep their Menu shape, sourced from site.blocks.
    const menu: Menu = { location: 'primary', items: site.blocks.primary };
    const footerMenu: Menu = { location: 'secondary', items: site.blocks.secondary };
    const locale = resolveLocale({ user: user?.locale ?? null, site: site.language });
    try {
      // The shell's site payload doubles as loader input — display
      // settings (comments per page, window order) shape resource reads.
      const value = await resource(client, site, { excludeNsfw });
      return { ok: true, site, origin, menu, footerMenu, user, locale, degraded: false, value };
    } catch (error) {
      return {
        ok: false,
        site,
        origin,
        menu,
        footerMenu,
        user,
        locale,
        degraded: false,
        error: pageError(error, { allow404: true }, t(locale)),
      };
    }
  } catch (error) {
    // The shell is broken: log why (server-side only), serve hardcoded chrome.
    // This is also first-hand evidence the backend is gone, so press the
    // breaker down — the next request gets the gate instead of another
    // half-rendered page.
    console.error('[loadPage] shell fetch failed:', error);
    if (isBackendOutage(error)) backend.markUnreachable(error);
    const locale = resolveLocale({});
    return {
      ok: false,
      site: fallbackSite,
      origin: '',
      menu: { location: 'primary', items: fallbackSite.blocks.primary },
      footerMenu: { location: 'secondary', items: fallbackSite.blocks.secondary },
      user: null,
      locale,
      degraded: true,
      error: pageError(error, { allow404: false }, t(locale)),
    };
  }
}
