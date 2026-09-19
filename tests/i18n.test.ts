import { describe, expect, it } from 'vitest';
import { AiyaApiError } from '@/lib/aiya/errors';
import {
  aiyaErrorCopy,
  normalizeLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  t,
  toBcp47,
} from '@/lib/i18n';
import { zh_CN } from '@/lib/i18n/dictionaries/zh_CN';
import { en_US } from '@/lib/i18n/dictionaries/en_US';
import { zh_HK } from '@/lib/i18n/dictionaries/zh_HK';
import { zh_TW } from '@/lib/i18n/dictionaries/zh_TW';

describe('locale resolution', () => {
  it('normalizes raw tags onto the supported set', () => {
    expect(normalizeLocale('zh-cn')).toBe('zh_CN');
    expect(normalizeLocale('ZH_TW')).toBe('zh_TW');
    expect(normalizeLocale('zh-Hant-HK')).toBe('zh_HK');
    expect(normalizeLocale('zh_SG')).toBe('zh_CN');
    expect(normalizeLocale('en')).toBe('en_US');
    expect(normalizeLocale('fr_FR')).toBe('zh_CN');
    expect(normalizeLocale(null)).toBe('zh_CN');
  });

  it('prefers the viewer, then the site default', () => {
    expect(resolveLocale({ user: 'en_US', site: 'zh_CN' })).toBe('en_US');
    expect(resolveLocale({ user: '', site: 'zh_TW' })).toBe('zh_TW');
    expect(resolveLocale({})).toBe('zh_CN');
  });

  it('maps onto BCP 47 for html lang', () => {
    expect(toBcp47('zh_CN')).toBe('zh-CN');
    expect(toBcp47('zh_HK')).toBe('zh-HK');
    expect(toBcp47('en_US')).toBe('en-US');
  });
});

describe('dictionaries', () => {
  const dictionaries = { zh_CN, zh_TW, zh_HK, en_US };

  it('cover exactly the supported locales', () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('keep structural parity across every section', () => {
    const keysOf = (value: unknown, path = ''): string[] => {
      if (typeof value !== 'object' || value === null) return [path];
      return Object.entries(value).flatMap(([key, child]) =>
        keysOf(child, path ? `${path}.${key}` : key),
      );
    };
    const reference = keysOf(zh_CN).sort();
    for (const locale of SUPPORTED_LOCALES) {
      expect(keysOf(dictionaries[locale]).sort(), `${locale} key parity`).toEqual(reference);
    }
  });
});

describe('aiyaErrorCopy', () => {
  it('maps machine codes to front-end copy', () => {
    const error = new AiyaApiError('http', 409, 'abcd1234', 'aiya_email_exists');
    expect(aiyaErrorCopy(error, 'zh_CN')).toBe(zh_CN.errors.aiya_email_exists);
    expect(aiyaErrorCopy(error, 'en_US')).toBe(en_US.errors.aiya_email_exists);
  });

  it('answers 429 with the rate-limit copy regardless of code', () => {
    const error = new AiyaApiError('http', 429, 'abcd1234', 'aiya_not_found');
    expect(aiyaErrorCopy(error, 'zh_TW')).toBe(zh_TW.errors.aiya_rate_limited);
  });

  it('falls back to generic copy for unknown codes and non-API errors', () => {
    expect(aiyaErrorCopy(new AiyaApiError('http', 500, undefined, 'rest_unknown'), 'zh_CN')).toBe(
      zh_CN.errors.generic,
    );
    expect(aiyaErrorCopy(new Error('boom'), 'en_US')).toBe(en_US.errors.generic);
  });

  it('exposes every locale through t()', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(t(locale).common.retry.length).toBeGreaterThan(0);
    }
  });
});
