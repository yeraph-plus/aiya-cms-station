import type { AstroCookies } from 'astro';

/**
 * The NSFW switch pair (0.96.0). The soft switch lives browser-side in a
 * first-party cookie — not localStorage, deliberately: the content lists
 * render server-side (SSR), so the preference must ride every request
 * for the backend exclusion flag to apply before any HTML is produced.
 * The hard switch ("always show NSFW content") is the account's user meta
 * and is enforced server-side by the backend itself; this module only
 * mirrors the soft state into queries and UI props.
 *
 * Cookie absent = switch off = NSFW hidden (the exclusion flag rides).
 */
export const NSFW_COOKIE = 'aiya_nsfw';

/** One year; the switch is a standing preference, not session state. */
export const NSFW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The visitor's soft switch: "show NSFW content". */
export function softShowNsfw(cookies: AstroCookies): boolean {
  return cookies.get(NSFW_COOKIE)?.value === '1';
}

/**
 * Whether the content reads this visitor renders should carry the NSFW
 * exclusion flag. True unless the soft switch says show — the hard switch
 * (user meta) is the backend's own override, so the flag may safely ride
 * for a hard-switch user; the backend ignores it there.
 */
export function nsfwExcluded(cookies: AstroCookies): boolean {
  return !softShowNsfw(cookies);
}
