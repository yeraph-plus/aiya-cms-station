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

  // The node adapter resolves `clientAddress` from the *first* entry of
  // X-Forwarded-For whenever the Host matched `security.allowedDomains`, and
  // an edge written as `$proxy_add_x_forwarded_for` appends rather than
  // replaces. So an address that equals that first entry is caller-chosen.
  describe('a forwarded resolution is not an identity', () => {
    it('refuses the address the adapter lifted out of X-Forwarded-For', () => {
      const request = req({ 'X-Forwarded-For': '198.51.100.4' });
      expect(resolveVisitorIp(request, '198.51.100.4', '')).toBeNull();
    });

    it('refuses it even when the edge also forwarded a host and proto', () => {
      const request = req({
        'X-Forwarded-For': '198.51.100.4, 10.0.0.2',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'site.name',
      });
      expect(resolveVisitorIp(request, '198.51.100.4', '')).toBeNull();
    });

    it('sees through the IPv4-mapped IPv6 prefix', () => {
      const request = req({ 'X-Forwarded-For': '198.51.100.4' });
      expect(resolveVisitorIp(request, '::ffff:198.51.100.4', '')).toBeNull();
    });

    it('still uses the socket address when the forwarded value differs', () => {
      // Host not validated: the adapter kept the socket peer and the header is
      // just along for the ride.
      const request = req({ 'X-Forwarded-For': '198.51.100.4' });
      expect(resolveVisitorIp(request, '192.0.2.9', '')).toBe('192.0.2.9');
    });
  });

  it('prefers the overwritten edge header over the forwarded list', () => {
    const request = req({
      'X-Real-IP': '203.0.113.7',
      'X-Forwarded-For': '198.51.100.4, 10.0.0.2',
    });
    expect(resolveVisitorIp(request, '198.51.100.4', 'X-Real-IP')).toBe('203.0.113.7');
  });
});
