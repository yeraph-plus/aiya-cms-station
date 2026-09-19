import { describe, expect, it } from 'vitest';
import { iconInner } from '@/lib/icons';

describe('iconInner (lucide-static lookup)', () => {
  it('resolves kebab-case, camelCase and PascalCase names', () => {
    const home = iconInner('home');
    expect(home).toContain('<path');
    expect(iconInner('message-circle')).toBe(iconInner('messageCircle'));
    expect(iconInner('ChevronRight')).toBe(iconInner('chevron-right'));
  });

  it('returns null for unknown names so callers can fall back', () => {
    expect(iconInner('not-an-icon')).toBeNull();
    expect(iconInner('')).toBeNull();
  });

  it('keeps inner markup free of the outer svg shell', () => {
    const inner = iconInner('home') ?? '';
    expect(inner.startsWith('<')).toBe(true);
    expect(inner.toLowerCase()).not.toContain('<svg');
  });
});
