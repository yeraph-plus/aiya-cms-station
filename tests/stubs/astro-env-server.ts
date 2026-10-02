/**
 * Vitest stand-in for Astro's virtual `astro:env/server` module, which
 * only exists inside the Astro Vite pipeline. Tests that import server
 * code (lib/core/server.ts and everything above it) resolve this stub
 * through the vitest.config alias; env values are read from process.env
 * at call time, so each test controls its own configuration.
 */
export function getSecret(key: string): string | undefined {
  return process.env[key];
}
