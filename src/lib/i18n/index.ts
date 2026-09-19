import { AiyaApiError } from '@/lib/aiya/errors';
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
