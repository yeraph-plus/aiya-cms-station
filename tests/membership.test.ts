import { describe, expect, it } from 'vitest';
import type { Tier } from '@/lib/aiya/contracts';
import {
  displayDateTime,
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

describe('displayDateTime / displayDay', () => {
  it('renders in the requested timezone', () => {
    // Same instant, two zones: 16:30 UTC is already the next day in Shanghai.
    expect(displayDateTime('2026-01-01T16:30:00Z', 'en_US', 'UTC')).toContain('16:30');
    expect(displayDateTime('2026-01-01T16:30:00Z', 'en_US', 'Asia/Shanghai')).toContain('00:30');
  });

  it('returns an empty string for unusable input', () => {
    expect(displayDateTime('', 'zh_CN', 'Asia/Shanghai')).toBe('');
    expect(displayDay('not-a-date', 'zh_CN', 'Asia/Shanghai')).toBe('');
  });

  it('still renders a day when the timezone is unknown', () => {
    expect(displayDay('2026-01-01T16:30:00Z', 'en_US', 'Not/AZone')).toContain('2026');
  });
});
