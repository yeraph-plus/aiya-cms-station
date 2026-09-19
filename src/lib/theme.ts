/**
 * Theme consumption helpers: derive readable text colors and validated
 * values from the brand color configured on the WP Frontend settings page.
 * Pure functions — safe outside Astro.
 */

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
  return `:root:root{--primary:${primary};--primary-foreground:${foregroundOn(primary)};}`;
}
