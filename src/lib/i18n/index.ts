import { AiyaApiError } from '@/lib/core/errors';
import type { Dictionary } from './dictionaries/zh_CN';
import { en_US } from './dictionaries/en_US';
import { zh_CN } from './dictionaries/zh_CN';
import { zh_HK } from './dictionaries/zh_HK';
import { zh_TW } from './dictionaries/zh_TW';
import type { Locale } from './locale';

export type { Dictionary } from './dictionaries/zh_CN';
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  resolveLocale,
  toBcp47,
} from './locale';
export type { Locale } from './locale';

const DICTIONARIES: Record<Locale, Dictionary> = {
  zh_CN,
  zh_TW,
  zh_HK,
  en_US,
};

/** The dictionary for a locale; use property access (`copy.state.retry`), not string keys. */
export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Front-end-owned copy for a failed API call, resolved from the envelope's
 * machine code. Backend messages are never displayed.
 */
export function aiyaErrorCopy(error: unknown, locale: Locale): string {
  const dict = t(locale);
  if (error instanceof AiyaApiError) {
    if (error.status === 429) return dict.errors.aiya_rate_limited;
    if (error.code) {
      const copy = (dict.errors as Record<string, string | undefined>)[error.code];
      if (copy) return copy;
    }
  }
  return dict.errors.generic;
}

/**
 * The four supported UI languages, labeled in their own language (a language
 * switcher is the one surface that must NOT translate its labels). Single
 * source for the settings panel and the account hub — the lists were hand-
 * duplicated before and would drift.
 */
export const LOCALE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'zh_CN', label: '简体中文' },
  { value: 'zh_TW', label: '繁體中文' },
  { value: 'zh_HK', label: '繁體中文（香港）' },
  { value: 'en_US', label: 'English' },
];

/**
 * The copy pack the settings island consumes, projected off the dictionary
 * (a handful of keys come from `shell`). Both mounting pages rendered this
 * 24-key map by hand before — one source, or a new setting key drifts.
 */
export function settingsCopy(copy: Dictionary) {
  return {
    avatarTitle: copy.settings.avatarTitle,
    changeAvatar: copy.settings.changeAvatar,
    removeAvatar: copy.settings.removeAvatar,
    avatarRemoveConfirm: copy.settings.avatarRemoveConfirm,
    cancel: copy.settings.cancel,
    profileTitle: copy.settings.profileTitle,
    nicknameLabel: copy.shell.nicknameLabel,
    descriptionLabel: copy.settings.descriptionLabel,
    urlLabel: copy.settings.urlLabel,
    localeLabel: copy.settings.localeLabel,
    emailLabel: copy.shell.emailLabel,
    currentPasswordLabel: copy.settings.currentPasswordLabel,
    currentPasswordHint: copy.settings.currentPasswordHint,
    accountTitle: copy.settings.accountTitle,
    newPasswordLabel: copy.settings.newPasswordLabel,
    newPasswordHint: copy.settings.newPasswordHint,
    alwaysShowNsfw: copy.settings.alwaysShowNsfw,
    alwaysShowNsfwHint: copy.settings.alwaysShowNsfwHint,
    passwordConfirmLabel: copy.shell.passwordConfirmLabel,
    save: copy.settings.save,
    saved: copy.settings.saved,
    passwordSaved: copy.settings.passwordSaved,
    authFailed: copy.shell.authFailed,
  };
}

export type SettingsCopy = ReturnType<typeof settingsCopy>;
