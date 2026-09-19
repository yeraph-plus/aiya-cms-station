/// <reference types="astro/client" />
import type { Crumb } from '@/lib/breadcrumbs';

declare global {
  namespace App {
    interface Locals {
      /** Per-request breadcrumb trail; populated by pages via setCrumbs(). */
      breadcrumbs?: Crumb[];
    }
  }
}
