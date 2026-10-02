import { describe, expect, it } from 'vitest';
import { WP_API_CONTRACT_ROOT, wpApiBaseUrl } from '@/lib/wp-env';

describe('wpApiBaseUrl', () => {
  it('appends the frozen contract root to a bare origin', () => {
    expect(wpApiBaseUrl('https://wp.example.com')).toBe(
      'https://wp.example.com/wp-json/aiya/core/v1/',
    );
    expect(wpApiBaseUrl('https://wp.example.com/')).toBe(
      'https://wp.example.com/wp-json/aiya/core/v1/',
    );
  });

  it('keeps an explicit contract root untouched (older deploys keep working)', () => {
    const full = 'https://wp.example.com/wp-json/aiya/core/v1/';
    expect(wpApiBaseUrl(full)).toBe(full);
  });

  it('answers empty for unparseable input and passes stray paths through to fail closed', () => {
    expect(wpApiBaseUrl('')).toBe('');
    expect(wpApiBaseUrl('not a url')).toBe('');
    expect(wpApiBaseUrl('https://wp.example.com/typo/')).toBe('https://wp.example.com/typo/');
  });

  it('exposes the single contract root constant', () => {
    expect(WP_API_CONTRACT_ROOT).toBe('/wp-json/aiya/core/v1/');
  });
});
