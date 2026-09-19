/**
 * Locale plumbing for the front end's own i18n. Copy is never extracted
 * from the backend (D8): the backend only tells us which language the
 * viewer prefers, via `user.locale` (profile setting, whitelist
 * zh_CN/zh_TW/zh_HK/en_US) and `site.language` (site default).
 */
export const SUPPORTED_LOCALES = ['zh_CN', 'zh_TW', 'zh_HK', 'en_US'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh_CN';

const BCP47: Record<Locale, string> = {
  zh_CN: 'zh-CN',
  zh_TW: 'zh-TW',
  zh_HK: 'zh-HK',
  en_US: 'en-US',
};

/** `<html lang>` value for a locale (WP locales use underscores, HTML wants BCP 47). */
export function toBcp47(locale: Locale): string {
  return BCP47[locale];
}

/** Maps any raw locale tag (WP locale, BCP 47, partial) onto the supported set. */
export function normalizeLocale(raw: string | null | undefined): Locale {
  const value = raw?.trim().toLowerCase().replace(/-/g, '_') ?? '';
  if ((SUPPORTED_LOCALES as readonly string[]).includes(value)) return value as Locale;
  if (value.startsWith('zh')) {
    if (value.includes('hk')) return 'zh_HK';
    if (value.includes('tw') || value.includes('hant')) return 'zh_TW';
    return 'zh_CN';
  }
  if (value.startsWith('en')) return 'en_US';
  return DEFAULT_LOCALE;
}

/** Signed-in viewer's choice wins; the site default is the fallback. */
export function resolveLocale(prefs: { user?: string | null; site?: string | null }): Locale {
  const user = prefs.user?.trim();
  if (user) return normalizeLocale(user);
  const site = prefs.site?.trim();
  if (site) return normalizeLocale(site);
  return DEFAULT_LOCALE;
}
