import { t, type Locale } from '@/lib/i18n';

export interface Crumb {
  label: string;
  href?: string;
}

type LocalsWithCrumbs = { breadcrumbs?: Crumb[] };

/**
 * Registration-style breadcrumbs: a page declares its trail in frontmatter
 * (`setCrumbs(Astro.locals, page.locale, [...])`), and the shell renders it
 * through `<Breadcrumb />` in one place. The home crumb is prepended from
 * the page locale; the last item is the current page (no href). New pages
 * extend the surface with one import + one call — no layout changes.
 */
export function setCrumbs(locals: LocalsWithCrumbs, locale: Locale, items: Crumb[]): void {
  const home: Crumb = { label: t(locale).common.home, href: '/' };
  locals.breadcrumbs = [home, ...items];
}
