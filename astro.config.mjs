import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// SSR everywhere (SEO), node standalone runtime. trailingSlash stays
// 'ignore' (not 'always') so file-like /media/ paths and dot segments never
// 404 at the router; the canonical slash shape is enforced by the
// middleware's 308 normalization instead. The backend DTO `url` fields
// already carry their trailing slash.
//
// The SSR-dependency bundling is build-only by way of an integration hook:
// the top-level config must stay a plain object — Astro 7.3.1's loader never
// invokes a function-form default export, and mergeConfig then spreads the
// function into {}, silently dropping the whole file (dev ran on defaults,
// output=static). Conditional config goes through astro:config:setup instead,
// whose updateConfig merges plain objects only.
const bundleSsrDepsForStandalone = {
  name: 'bundle-ssr-deps-for-standalone',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command !== 'build') return;
      updateConfig({
        vite: {
          ssr: { noExternal: true },
        },
      });
    },
  },
};

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  // The node adapter rebuilds each request URL from the socket, so behind a
  // TLS-terminating edge (browser https → plain http to this container) the
  // built-in CSRF origin check sees Origin https://site vs URL origin
  // http://site and 403s every non-JSON POST (logout, like, multipart
  // uploads, …). allowedDomains is the switch that makes the adapter trust
  // X-Forwarded-Proto/Host when rebuilding that URL; `{}` trusts any edge
  // host because the domain is runtime config and the image builds without
  // it. The check itself stays on: genuinely cross-site posts still 403,
  // and a browser cannot set X-Forwarded-* cross-site without a CORS
  // preflight this server never answers.
  security: {
    allowedDomains: [{}],
  },
  integrations: [react(), bundleSsrDepsForStandalone],
  vite: {
    plugins: [tailwindcss()],
    // Dev keeps the default dependency externalization — with `ssr.noExternal`
    // the Vite 8 module runner evaluates react's CJS entry as ESM and crashes
    // with "module is not defined" before the first request. The standalone
    // build re-adds the flag via the integration above.
  },
});
