import * as lucide from 'lucide-static';

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
