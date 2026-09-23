/**
 * Backend reachability circuit breaker. Every page request asks whether the
 * content service is up before anything is rendered; a backend that cannot
 * answer is a gate condition, not a per-page error.
 *
 * Two TTLs, deliberately asymmetric:
 *   - reachable → re-probe rarely (the answer is almost always "up", and a
 *     probe costs one upstream round-trip);
 *   - unreachable → re-probe soon (a recovered backend must start serving
 *     again without an operator touching anything).
 *
 * Concurrent callers share one in-flight probe, so a burst on a cold cache
 * still makes a single upstream call. Pure and injectable (no `astro:env`),
 * mirroring `page-error.ts`, so the timing rules stay unit-testable.
 */

/**
 * Whether a failed shell fetch means the backend itself is unusable, and so
 * warrants the site gate. A 4xx proves the backend is answering — a missing
 * or misconfigured shell endpoint is a deployment fault to fix, not an
 * outage to wall visitors out for; gating on it would only make the gate
 * flap open and shut every re-probe interval. Everything else — network,
 * timeout, 5xx, contract drift, bad config — is a genuine outage.
 */
import { AiyaApiError } from '@/lib/core/errors';

export function isBackendOutage(error: unknown): boolean {
  if (error instanceof AiyaApiError) return !(error.kind === 'http' && error.status < 500);
  return true;
}

export interface ReachabilityOptions {
  /** Resolves when the backend answered; throws when it did not. */
  probe: () => Promise<unknown>;
  ttlUpMs?: number;
  ttlDownMs?: number;
  now?: () => number;
  /**
   * Called only when the verdict *changes* (including the first probe), so a
   * long outage reports once instead of once per TTL. `error` is whatever the
   * probe threw, for the server log.
   */
  onVerdict?: (reachable: boolean, error: unknown) => void;
}

export interface Reachability {
  /** True while the last probe succeeded and its TTL has not lapsed. */
  isReachable: () => Promise<boolean>;
  /**
   * Records a first-hand failure observed by a caller — a page whose shell
   * fetch just died. Without this, an outage discovered mid-request would go
   * ungated for the rest of the optimistic up-TTL, so visitors would get
   * per-page errors instead of the gate. The verdict is reused as-is, so the
   * next request is gated without paying another probe.
   */
  markUnreachable: (error?: unknown) => void;
  /** Drops the memoised verdict — the next call probes immediately. */
  reset: () => void;
}

export function createReachability(options: ReachabilityOptions): Reachability {
  const { probe, ttlUpMs = 10_000, ttlDownMs = 3_000, now = Date.now, onVerdict } = options;
  let verdict: { reachable: boolean; at: number } | null = null;
  let inflight: Promise<boolean> | null = null;
  let reported: boolean | null = null;

  const isReachable = async (): Promise<boolean> => {
    const at = now();
    if (verdict && at - verdict.at < (verdict.reachable ? ttlUpMs : ttlDownMs)) {
      return verdict.reachable;
    }
    if (inflight) return inflight;
    inflight = (async () => {
      let reachable = false;
      let error: unknown;
      try {
        await probe();
        reachable = true;
      } catch (caught) {
        // Any failure — network, timeout, contract drift, bad config —
        // means the backend cannot serve this request.
        reachable = false;
        error = caught;
      }
      verdict = { reachable, at: now() };
      report(reachable, error);
      return reachable;
    })();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  };

  const report = (reachable: boolean, error: unknown) => {
    if (onVerdict && reachable !== reported) {
      reported = reachable;
      onVerdict(reachable, error);
    }
  };

  return {
    isReachable,
    markUnreachable: (error?: unknown) => {
      verdict = { reachable: false, at: now() };
      report(false, error);
    },
    reset: () => {
      verdict = null;
      reported = null;
    },
  };
}
