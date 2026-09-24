import { describe, expect, it } from 'vitest';
import type { Tier } from '@/lib/core/contracts';
import { displayDay, paymentMethods, purchasableTiers } from '@/lib/membership';

describe('tier selection', () => {
  const tier = (key: string, enabled: boolean): Tier => ({
    key,
    name: key,
    price: 10,
    cycleDays: 31,
    creditsPerCycle: 5,
    enabled,
    cycles: 3,
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
