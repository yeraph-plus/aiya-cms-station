import { describe, expect, it } from 'vitest';
import { AiyaApiError } from '@/lib/core/errors';
import { t } from '@/lib/i18n';
import { pageError } from '@/lib/page-error';

const copy = t('zh_CN');
const copyEn = t('en_US');

describe('pageError mapping', () => {
  it('reports 404 as not-found only when the shell survived', () => {
    const notFound = new AiyaApiError('http', 404, 'abcd1234', 'aiya_not_found');
    expect(pageError(notFound, { allow404: true }, copy)).toEqual({
      status: 404,
      title: copy.state.notFoundTitle,
      message: copy.state.notFoundMessage,
    });
    // A dead shell must not say "this content is missing".
    expect(pageError(notFound, { allow404: false }, copy).status).toBe(502);
  });

  it('maps timeouts and configuration errors to their own states', () => {
    expect(pageError(new AiyaApiError('timeout', 504), { allow404: true }, copy).status).toBe(504);
    expect(pageError(new AiyaApiError('timeout', 504), { allow404: true }, copy).title).toBe(
      copy.state.timeoutTitle,
    );
    expect(
      pageError(new AiyaApiError('configuration', 503), { allow404: true }, copyEn).title,
    ).toBe(copyEn.state.unreadyTitle);
  });

  it('falls back to the backend-down copy for unknown failures', () => {
    expect(pageError(new Error('boom'), { allow404: true }, copy)).toEqual({
      status: 502,
      title: copy.state.backendTitle,
      message: copy.state.backendMessage,
    });
    expect(pageError(new AiyaApiError('http', 500), { allow404: false }, copy).status).toBe(502);
  });
});

describe('shell dictionary', () => {
  it('interpolates the welcome line per locale', () => {
    expect(copy.shell.welcome('AIYA')).toBe('欢迎来到，AIYA。');
    expect(copyEn.shell.welcome('AIYA')).toBe('Welcome to AIYA.');
  });

  it('labels every backend role', () => {
    for (const role of ['administrator', 'author', 'sponsor', 'subscriber'] as const) {
      expect(copy.shell.roleLabels[role].length).toBeGreaterThan(0);
      expect(copyEn.shell.roleLabels[role].length).toBeGreaterThan(0);
    }
  });

  it('carries the auth form labels the island needs', () => {
    for (const key of [
      'emailLabel',
      'passwordLabel',
      'passwordConfirmLabel',
      'nicknameLabel',
      'authFailed',
    ] as const) {
      expect(copy.shell[key].length).toBeGreaterThan(0);
    }
  });
});
