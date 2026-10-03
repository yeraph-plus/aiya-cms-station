import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Astro's virtual env module does not exist outside the Astro
      // pipeline; server-side tests resolve the process.env stub instead.
      'astro:env/server': fileURLToPath(
        new URL('./tests/stubs/astro-env-server.ts', import.meta.url),
      ),
      // Same for the middleware namespace: the identity helper is all the
      // middleware test needs to drive the real handler directly.
      'astro:middleware': fileURLToPath(
        new URL('./tests/stubs/astro-middleware.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
