/**
 * Color mode engine. The preference is one of three values — dark, light or
 * system — stored in localStorage. Desktop follows the stored preference;
 * the mobile shell always resolves to system, regardless of a manual desktop
 * choice (UX.md §6). The pre-paint script in BaseHead applies the initial
 * class before first paint; this module owns the live resolution, the
 * system/breakpoint listeners and the desktop toggle's cycle.
 *
 * Browser globals are only touched inside functions: the module is imported
 * by the ColorModeToggle island, which also renders on the server.
 */

export type ColorMode = 'dark' | 'light' | 'system';

export const COLOR_MODE_STORAGE_KEY = 'aiya-color-mode';

/** The shell breakpoint's mobile side (DESIGN.md §2: 992px switch). */
const MOBILE_QUERY = '(max-width: 991px)';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function isColorMode(value: string | null | undefined): value is ColorMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

/** Desktop cycle: dark → light → system → dark. */
export function nextColorMode(mode: ColorMode): ColorMode {
  if (mode === 'dark') return 'light';
  if (mode === 'light') return 'system';
  return 'dark';
}

/** Stored choice → site default → system. Invalid values are ignored. */
export function resolveColorPreference(
  stored: string | null | undefined,
  siteDefault: string | null | undefined,
): ColorMode {
  if (isColorMode(stored)) return stored;
  if (isColorMode(siteDefault)) return siteDefault;
  return 'system';
}

/** Which preference applies at this viewport width. */
export function resolveColorMode(
  stored: string | null | undefined,
  siteDefault: string | null | undefined,
  mobile: boolean,
): ColorMode {
  return mobile ? 'system' : resolveColorPreference(stored, siteDefault);
}

/** Whether a resolved preference paints the dark palette. */
export function darkFor(mode: ColorMode, systemDark: boolean): boolean {
  return mode === 'dark' || (mode === 'system' && systemDark);
}

function readStoredMode(): ColorMode | null {
  try {
    const value = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
    return isColorMode(value) ? value : null;
  } catch {
    // Storage unavailable (private mode) — fall through to the site default.
    return null;
  }
}

function siteDefaultMode(): ColorMode | null {
  const value = document.documentElement.dataset.colorModeDefault;
  return isColorMode(value) ? value : null;
}

function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Stamp the resolved preference and its effective palette on <html>. */
export function applyColorMode(mode: ColorMode): void {
  const root = document.documentElement;
  root.dataset.colorMode = mode;
  root.classList.toggle('dark', darkFor(mode, systemPrefersDark()));
}

/** The preference currently stamped by the pre-paint script, with a fallback. */
export function currentColorMode(): ColorMode {
  const stamped = document.documentElement.dataset.colorMode;
  if (isColorMode(stamped)) return stamped;
  return resolveColorMode(readStoredMode(), siteDefaultMode(), isMobileViewport());
}

/**
 * Desktop toggle: advance one step and persist. Mobile has no toggle; if the
 * event ever fires there it resolves back to system without overwriting the
 * desktop preference.
 */
export function cycleColorMode(): ColorMode {
  if (isMobileViewport()) {
    applyColorMode('system');
    return 'system';
  }
  const next = nextColorMode(currentColorMode());
  try {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
  } catch {
    // The class toggle still takes effect without persistence.
  }
  applyColorMode(next);
  return next;
}

let initialized = false;

/**
 * Wire the live resolution once per document: re-apply when the system
 * palette changes or the viewport crosses the shell breakpoint. AppShell
 * calls this from its bundled script; ClientRouter swaps keep the listeners
 * and the BaseHead pre-paint script re-stamps the new <html>.
 */
export function initColorMode(): void {
  if (initialized) return;
  initialized = true;
  const apply = () => {
    applyColorMode(resolveColorMode(readStoredMode(), siteDefaultMode(), isMobileViewport()));
  };
  apply();
  window.matchMedia(DARK_QUERY).addEventListener('change', apply);
  window.matchMedia(MOBILE_QUERY).addEventListener('change', apply);
}
