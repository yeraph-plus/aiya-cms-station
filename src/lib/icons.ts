import * as lucide from 'lucide-static';
import type { MenuItem } from '@/lib/core/contracts';

/**
 * Server-side icon lookup over lucide-static (2079 icons as SVG strings).
 * Names are normalized to PascalCase, so `home`, `message-circle` and
 * `messageCircle` all resolve. Unknown names return null — callers fall
 * back (Icon.astro uses the chevron). Results are cached per lowercase
 * name; the markup is package-trusted and injected via set:html only.
 */

const cache = new Map<string, string | null>();

const toPascal = (name: string): string =>
  name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

/** Inner SVG markup of one lucide icon; null when the name does not exist. */
export function iconInner(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return null;
  const key = trimmed.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  // PascalCase must be derived from the original casing: lowercasing first
  // would turn `messageCircle` into `Messagecircle`, which does not exist.
  const raw = (lucide as Record<string, unknown>)[toPascal(trimmed)];
  let result: string | null = null;
  if (typeof raw === 'string') {
    result = raw
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .trim();
  }
  cache.set(key, result);
  return result;
}

/** Lucide name for a menu row: the settings-set icon wins; otherwise the
    URL shape picks one. Shared by the desktop sidebar and the mobile
    TabBar/drawer so both shells can never disagree on an item's icon. */
export function menuIconName(item: MenuItem): string {
  if (item.icon) return item.icon;
  const url = item.url;
  if (/^https?:\/\//i.test(url)) return 'externalLink';
  if (url === '/') return 'home';
  if (url.startsWith('/resources')) return 'image';
  if (url.startsWith('/community')) return 'messageCircle';
  if (url.startsWith('/posts')) return 'fileText';
  if (url.startsWith('/profile')) return 'user';
  return 'chevronRight';
}
