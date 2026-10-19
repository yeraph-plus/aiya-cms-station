import { describe, expect, it } from 'vitest';
import type { MembershipEntitlement, Tier } from '@/lib/core/contracts';
import {
  activeMembershipTier,
  displayDay,
  paymentMethods,
  purchasableTiers,
} from '@/lib/membership';

describe('tier selection', () => {
  const tier = (key: string, enabled: boolean): Tier => ({
    key,
    name: key,
    price: 10,
    cycleDays: 31,
    creditsPerCycle: 5,
    enabled,
    description: '',
  });

  it('hides tiers the backend disabled', () => {
    const items = [tier('a', true), tier('b', false)];
    expect(purchasableTiers(items).map((t) => t.key)).toEqual(['a']);
  });

  it('offers no cashier methods when the gateway is off', () => {
    expect(paymentMethods({ epay: false, methods: ['alipay'] })).toEqual([]);
    expect(paymentMethods({ epay: true, methods: ['alipay', 'wxpay'] })).toEqual([
      'alipay',
      'wxpay',
    ]);
  });
});

describe('active membership tier', () => {
  const row = (overrides: Partial<MembershipEntitlement> = {}): MembershipEntitlement => ({
    tierKey: 'tier',
    tierName: 'Tier',
    cycleDays: 30,
    creditsPerCycle: 5,
    cyclesTotal: 1,
    cyclesGranted: 1,
    startsAt: '2026-01-01T00:00:00+08:00',
    endsAt: '2026-02-01T00:00:00+08:00',
    status: 'active',
    ...overrides,
  });

  it('picks the active row whose window covers now, even across offsets', () => {
    const active = row();
    const now = Date.parse('2026-01-15T00:00:00Z');
    expect(activeMembershipTier({ queue: [active] }, now)).toEqual(active);
    // Same instants expressed with a different offset still compare correctly.
    const shifted = row({
      startsAt: '2025-12-31T16:00:00Z',
      endsAt: '2026-01-31T16:00:00Z',
    });
    expect(activeMembershipTier({ queue: [shifted] }, now)).toEqual(shifted);
  });

  it('ignores cancelled and out-of-window rows', () => {
    const now = Date.parse('2026-01-15T00:00:00Z');
    expect(activeMembershipTier({ queue: [row({ status: 'cancelled' })] }, now)).toBeNull();
    expect(
      activeMembershipTier(
        {
          queue: [
            row({ startsAt: '2026-02-01T00:00:00+08:00', endsAt: '2026-03-01T00:00:00+08:00' }),
          ],
        },
        now,
      ),
    ).toBeNull();
    expect(activeMembershipTier(null, now)).toBeNull();
  });
});

describe('displayDay', () => {
  it('renders in the requested timezone', () => {
    // Same instant, two zones: 16:30 UTC on Jan 1 is already Jan 2 in Shanghai.
    expect(displayDay('2026-01-01T16:30:00Z', 'en_US', 'UTC')).not.toBe(
      displayDay('2026-01-01T16:30:00Z', 'en_US', 'Asia/Shanghai'),
    );
  });

  it('returns an empty string for unusable input', () => {
    expect(displayDay('', 'zh_CN', 'Asia/Shanghai')).toBe('');
    expect(displayDay('not-a-date', 'zh_CN', 'Asia/Shanghai')).toBe('');
  });

  it('still renders a day when the timezone is unknown', () => {
    expect(displayDay('2026-01-01T16:30:00Z', 'en_US', 'Not/AZone')).toContain('2026');
  });
});
