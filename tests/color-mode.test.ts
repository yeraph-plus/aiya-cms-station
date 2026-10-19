import { describe, expect, it } from 'vitest';
import { darkFor, nextColorMode, resolveColorMode, resolveColorPreference } from '@/lib/color-mode';

describe('color mode cycle', () => {
  it('walks dark → light → system → dark', () => {
    expect(nextColorMode('dark')).toBe('light');
    expect(nextColorMode('light')).toBe('system');
    expect(nextColorMode('system')).toBe('dark');
  });

  it('resolves stored and site defaults, ignoring invalid values', () => {
    expect(resolveColorPreference('dark', 'light')).toBe('dark');
    expect(resolveColorPreference(null, 'light')).toBe('light');
    expect(resolveColorPreference('bogus', 'bogus')).toBe('system');
    expect(resolveColorPreference('system', 'dark')).toBe('system');
  });

  it('forces the mobile shell to follow the system palette', () => {
    expect(resolveColorMode('dark', 'light', true)).toBe('system');
    expect(resolveColorMode('light', 'dark', true)).toBe('system');
    // The stored desktop choice survives a round-trip to desktop.
    expect(resolveColorMode('dark', 'light', false)).toBe('dark');
  });

  it('paints dark only for the dark preference or a dark system', () => {
    expect(darkFor('dark', false)).toBe(true);
    expect(darkFor('light', true)).toBe(false);
    expect(darkFor('system', true)).toBe(true);
    expect(darkFor('system', false)).toBe(false);
  });
});
