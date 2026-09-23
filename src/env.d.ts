/// <reference types="astro/client" />
import type { Crumb } from '@/lib/breadcrumbs';

declare global {
  namespace App {
    interface Locals {
      /** Per-request breadcrumb trail; populated by pages via setCrumbs(). */
      breadcrumbs?: Crumb[];
      /** Localized aria-label for the breadcrumb nav (set by setCrumbs). */
      breadcrumbsLabel?: string;
      /** Visitor address resolved once by the middleware (lib/visitor-ip.ts);
          threaded into every SSR read so backend rate limiting and guest
          dedup bind to the real client, not this server's REMOTE_ADDR. */
      visitorIp?: string | null;
    }
  }
}
