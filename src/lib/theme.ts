/**
 * Theme consumption helpers: derive readable text colors and validated
 * values from the brand color configured on the WP Frontend settings page.
 * Pure functions — safe outside Astro.
 */

/** Hex color as the Frontend settings page should produce; anything else is
    admin-side misconfiguration, not content to render. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value);
}

/** Readable text color on top of a brand background (YIQ luminance rule). */
export function foregroundOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ([r, g, b].some(Number.isNaN)) return '#ffffff';
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#303039' : '#ffffff';
}

/**
 * Inline `:root` overrides for the brand palette. Doubled `:root:root`
 * wins specificity over tokens.css regardless of order.
 */
export function brandThemeStyle(primary: string): string {
  // The style rides an inline <style set:html> — an unvalidated value could
  // break out of the CSS context (`</style>…` / `}` injecting rules). The
  // default palette stands in for anything that is not a plain hex color.
  const safe = isHexColor(primary) ? primary : '#e94f69';
  return `:root:root{--primary:${safe};--primary-foreground:${foregroundOn(safe)};}`;
}
