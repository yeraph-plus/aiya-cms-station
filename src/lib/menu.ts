/**
 * Menu-link presentation shared by the three shells that render the primary
 * menu (desktop sidebar, mobile drawer, TabBar): the active state, the
 * external-link test and the row recipes. One source, or a highlight rule
 * change lands in one shell and misses the other two.
 */

/** Active state: the root matches exactly, every other entry by prefix. */
export function isMenuActive(pathname: string, url: string): boolean {
  return url === '/' ? pathname === '/' : pathname.startsWith(url);
}

/** External http(s) links open in a new tab without carrying this origin's
    referrer (menu items may point off-site). */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// Row proportions ported 1:1 from the frozen prototype (global.css
// .nav-items): min-height 44px, 14px text, 0.9rem gap, 5px radius, 0.2rem
// row gap. Kept as whole literals — Tailwind's scanner must see the final
// class strings, a composed template would never generate CSS.
export const MENU_LINK_CLASS =
  'my-0.5 flex min-h-[44px] items-center gap-3.5 rounded-md px-3.5 py-3 text-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue';

/** Sub-row: the prototype's compact 36px (desktop sidebar) and the drawer's
    44px touch-target lift, same recipe otherwise. */
export const MENU_SUBLINK_COMPACT =
  'flex min-h-[36px] items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue';

export const MENU_SUBLINK_TOUCH =
  'flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-focus-blue';
