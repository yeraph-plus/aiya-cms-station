import { createReachability } from '@/lib/reachability';
import { serverClient } from './server';

/**
 * The process-wide backend breaker. One instance is shared by the middleware
 * gate and by `robots.txt`, so the two surfaces always agree on whether the
 * content service is up — a crawler must never be told "index everything"
 * while visitors are being shown the gate.
 *
 * The probe is the very call the shell needs (`site`), so a "reachable"
 * verdict predicts the page read instead of guessing at it.
 */
export const backend = createReachability({
  probe: () => serverClient().site(),
  onVerdict: (reachable, error) => {
    if (reachable) console.info('[gate] backend reachable — serving pages');
    else console.error('[gate] backend unreachable — serving the gate:', error);
  },
});
