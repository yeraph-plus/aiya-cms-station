import { describe, expect, it } from 'vitest';
import { AiyaApiError } from '@/lib/core/errors';
import {
  aiyaErrorCopy,
  normalizeLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  t,
  toBcp47,
} from '@/lib/i18n';
import { notificationTime } from '@/lib/format';
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

describe('backend error-code coverage', () => {
  // Every machine code the backend's REST face can answer a visitor request
  // with (aiya-core src/Api/Rest + the domain codes those controllers
  // rethrow). Refresh this list when the backend contract gains codes — the
  // point is that a missing dictionary entry fails HERE instead of showing
  // visitors the generic fallback. Admin-surface and gateway-internal codes
  // (board_exists, tier_in_use, order_unattributed, …) are deliberately out.
  const BACKEND_VISITOR_CODES = [
    'aiya_account_disabled',
    'aiya_activation_busy',
    'aiya_activation_failed',
    'aiya_afdian_rejected',
    'aiya_afdian_unavailable',
    'aiya_already_logged_in',
    'aiya_avatar_missing',
    'aiya_avatar_rejected',
    'aiya_channel_unavailable',
    'aiya_code_activation_failed',
    'aiya_code_invalid',
    'aiya_code_used',
    'aiya_comment_flood',
    'aiya_comment_rejected',
    'aiya_comments_closed',
    'aiya_counter_missing_post',
    'aiya_counter_not_supported',
    'aiya_credit_checkin_disabled',
    'aiya_credit_checkin_done',
    'aiya_credit_duplicate',
    'aiya_credit_insufficient',
    'aiya_db_error',
    'aiya_duplicate_comment',
    'aiya_duplicate_order',
    'aiya_email_exists',
    'aiya_forbidden',
    'aiya_identity_required',
    'aiya_invalid_credentials',
    'aiya_invalid_param',
    'aiya_invalid_parent',
    'aiya_invalid_password',
    'aiya_invalid_reset_key',
    'aiya_invalid_return_url',
    'aiya_login_required',
    'aiya_mail_failed',
    'aiya_not_found',
    'aiya_not_logged_in',
    'aiya_order_bound',
    'aiya_order_not_found',
    'aiya_order_not_paid',
    'aiya_order_used',
    'aiya_plan_unbound',
    'aiya_rate_limited',
    'aiya_reauth_required',
    'aiya_registration_disabled',
    'aiya_registration_failed',
    'aiya_server_error',
    'aiya_source_denied',
    'aiya_source_invalid',
    'aiya_source_not_found',
    'aiya_source_unauthorized',
    'aiya_source_unreachable',
    'aiya_thread_locked',
    'aiya_tier_disabled',
    'aiya_update_failed',
    'aiya_upload_empty',
    'aiya_upload_failed',
    'aiya_upload_invalid',
    'aiya_upload_process',
    'aiya_upload_too_large',
    'aiya_upload_type',
    'aiya_upload_url',
    'aiya_upload_write',
    'aiya_user_missing',
    'aiya_validation_failed',
    'aiya_wrong_password',
  ] as const;

  it('the four dictionaries translate every backend visitor-reachable code', () => {
    for (const code of BACKEND_VISITOR_CODES) {
      for (const [name, dict] of Object.entries({ zh_CN, en_US, zh_HK, zh_TW })) {
        expect(
          (dict.errors as Record<string, string | undefined>)[code],
          `${name}:${code}`,
        ).toBeTypeOf('string');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Locale tags that reach Intl (regression: /notifications/ fed the WP
// underscore form 'zh_CN' straight into toLocaleString → RangeError inside
// a row renderer → React unmounted the whole island → an empty page for
// every signed-in visitor with at least one notification).
// ---------------------------------------------------------------------------

describe('locale tags are Intl-safe end to end', () => {
  it('every toBcp47 mapping is a valid Intl locale tag', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(() => new Intl.DateTimeFormat(toBcp47(locale))).not.toThrow();
    }
  });

  it('notificationTime degrades a malformed tag instead of throwing', () => {
    const value = '2026-10-01T04:10:41+08:00';
    expect(notificationTime(value, 'zh_CN')).toBe(notificationTime(value, 'zh-CN'));
    expect(() => notificationTime(value, 'not a tag')).not.toThrow();
    expect(notificationTime(value, 'not a tag')).not.toBe('');
  });

  it('notificationTime answers an unusable date with an empty string', () => {
    expect(notificationTime('garbage', 'zh-CN')).toBe('');
  });
});
