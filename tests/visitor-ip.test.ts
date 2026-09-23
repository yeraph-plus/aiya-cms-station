import { describe, expect, it } from 'vitest';
import { resolveVisitorIp } from '@/lib/visitor-ip';

const req = (headers: Record<string, string> = {}) =>
  new Request('https://front.example.com/api/feed/posts/', { headers });

describe('resolveVisitorIp', () => {
  it('prefers the trusted header when configured (first entry)', () => {
    const request = req({ 'X-Real-IP': '203.0.113.7, 10.0.0.1' });
    expect(resolveVisitorIp(request, '192.0.2.9', 'X-Real-IP')).toBe('203.0.113.7');
  });

  it('falls back to the socket address without a trusted header', () => {
    expect(resolveVisitorIp(req(), '192.0.2.9', '')).toBe('192.0.2.9');
  });

  it('falls back to the socket address when the trusted header is absent', () => {
    expect(resolveVisitorIp(req(), '192.0.2.9', 'CF-Connecting-IP')).toBe('192.0.2.9');
  });

  it('accepts IPv6 literals', () => {
    expect(resolveVisitorIp(req({ 'X-Real-IP': '2001:db8::1' }), null, 'X-Real-IP')).toBe(
      '2001:db8::1',
    );
  });

  it('discards junk instead of forwarding it', () => {
    expect(
      resolveVisitorIp(req({ 'X-Real-IP': 'not-an-ip' }), '192.0.2.9', 'X-Real-IP'),
    ).toBeNull();
    expect(resolveVisitorIp(req(), '', '')).toBeNull();
    expect(resolveVisitorIp(req({ 'X-Real-IP': 'x'.repeat(80) }), null, 'X-Real-IP')).toBeNull();
  });
});
