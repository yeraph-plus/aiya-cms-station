import { describe, expect, it } from 'vitest';
import { AiyaApiError } from '@/lib/core/errors';
import { GATE_STATUS, gateResponse, renderGateDocument } from '@/lib/gate';
import { t } from '@/lib/i18n';
import { createReachability, isBackendOutage } from '@/lib/reachability';

const copy = t('zh_CN');

describe('gate document', () => {
  it('answers 503 with no-store, retry-after and noindex', () => {
    const response = gateResponse('zh_CN', copy, '/posts/');
    expect(response.status).toBe(GATE_STATUS);
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('carries the backend-down copy and the requested path as the retry target', async () => {
    const html = await gateResponse('zh_CN', copy, '/posts/?category=dev').text();
    expect(html).toContain(copy.state.backendTitle);
    expect(html).toContain(copy.state.backendMessage);
    expect(html).toContain('href="/posts/?category=dev"');
    expect(html).toContain('<html lang="zh-CN">');
  });

  it('escapes interpolated copy and the retry path', () => {
    const hostile = {
      ...copy,
      state: { ...copy.state, backendTitle: '<script>alert(1)</script>', backendMessage: 'a & b' },
    };
    const html = renderGateDocument('en_US', hostile, '/x/"><img src=x onerror=y>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).not.toContain('onerror=y>');
    expect(html).toContain('&quot;&gt;&lt;img');
  });
});

describe('outage classification', () => {
  it('treats transport and server faults as an outage', () => {
    for (const kind of ['network', 'timeout', 'configuration', 'contract'] as const) {
      expect(isBackendOutage(new AiyaApiError(kind)), kind).toBe(true);
    }
    expect(isBackendOutage(new AiyaApiError('http', 500))).toBe(true);
    expect(isBackendOutage(new AiyaApiError('http', 502))).toBe(true);
    expect(isBackendOutage(new Error('boom'))).toBe(true);
  });

  it('does not gate on a 4xx, which proves the backend is answering', () => {
    expect(isBackendOutage(new AiyaApiError('http', 404, 'abcd1234', 'aiya_not_found'))).toBe(false);
    expect(isBackendOutage(new AiyaApiError('http', 403))).toBe(false);
  });
});

describe('backend reachability breaker', () => {
  /** A breaker over a fake clock and a probe whose health is switchable. */
  function harness(options: { ttlUpMs?: number; ttlDownMs?: number } = {}) {
    let clock = 0;
    let calls = 0;
    let healthy = true;
    const verdicts: boolean[] = [];
    const breaker = createReachability({
      now: () => clock,
      ttlUpMs: options.ttlUpMs ?? 10_000,
      ttlDownMs: options.ttlDownMs ?? 3_000,
      probe: async () => {
        calls += 1;
        if (!healthy) throw new Error('backend down');
      },
      onVerdict: (reachable) => verdicts.push(reachable),
    });
    return {
      breaker,
      verdicts,
      advance: (ms: number) => {
        clock += ms;
      },
      setHealthy: (value: boolean) => {
        healthy = value;
      },
      get calls() {
        return calls;
      },
    };
  }

  it('memoises a healthy verdict for the full up-TTL', async () => {
    const h = harness();
    expect(await h.breaker.isReachable()).toBe(true);
    expect(h.calls).toBe(1);

    h.advance(9_000);
    expect(await h.breaker.isReachable()).toBe(true);
    expect(h.calls).toBe(1);

    h.advance(2_000);
    expect(await h.breaker.isReachable()).toBe(true);
    expect(h.calls).toBe(2);
  });

  it('re-probes an outage on the shorter down-TTL and recovers on its own', async () => {
    const h = harness();
    h.setHealthy(false);
    expect(await h.breaker.isReachable()).toBe(false);
    expect(h.calls).toBe(1);

    // Inside the down-TTL the verdict is reused — no hammering.
    h.advance(1_000);
    expect(await h.breaker.isReachable()).toBe(false);
    expect(h.calls).toBe(1);

    // Past it the probe runs again, and a recovered backend is admitted
    // without any operator action.
    h.advance(3_000);
    h.setHealthy(true);
    expect(await h.breaker.isReachable()).toBe(true);
    expect(h.calls).toBe(2);
  });

  it('shares one in-flight probe between concurrent callers', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const breaker = createReachability({
      probe: async () => {
        calls += 1;
        await gate;
      },
    });
    const first = breaker.isReachable();
    const second = breaker.isReachable();
    release();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(calls).toBe(1);
  });

  it('presses down on a first-hand failure so the next request is gated', async () => {
    const h = harness();
    expect(await h.breaker.isReachable()).toBe(true);
    expect(h.calls).toBe(1);

    // A page's shell fetch dies while the optimistic up-TTL is still fresh.
    h.setHealthy(false);
    h.advance(1_000);
    h.breaker.markUnreachable(new Error('shell fetch failed'));

    // The very next request is gated, without paying for another probe.
    expect(await h.breaker.isReachable()).toBe(false);
    expect(h.calls).toBe(1);
    expect(h.verdicts).toEqual([true, false]);
  });

  it('reports only verdict changes, so an outage logs once', async () => {
    const h = harness({ ttlUpMs: 100, ttlDownMs: 100 });
    await h.breaker.isReachable();
    expect(h.verdicts).toEqual([true]);

    // Same verdict, re-probed twice — no new report.
    h.advance(200);
    await h.breaker.isReachable();
    h.advance(200);
    await h.breaker.isReachable();
    expect(h.verdicts).toEqual([true]);

    // Flip down, then back up: exactly two more reports.
    h.setHealthy(false);
    h.advance(200);
    await h.breaker.isReachable();
    h.setHealthy(true);
    h.advance(200);
    await h.breaker.isReachable();
    expect(h.verdicts).toEqual([true, false, true]);
  });
});
