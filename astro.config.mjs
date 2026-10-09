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
    // Astro's own CSP: every script and style the build emits is hashed
    // (SHA-256) and the policy ships on the response header, so `script-src`
    // / `style-src` cover the bundled modules, the hydration scripts and the
    // two inline `<script is:inline>` blocks in BaseHead (the pre-paint
    // colour-mode swap and the gtag config) without a nonce pipeline. The
    // three directives below are the rest of the baseline the middleware
    // used to own on its own; they live here so the page carries one policy
    // rather than two intersecting ones. The media proxy keeps its own
    // stronger `sandbox` for direct SVG opens — its responses never pass
    // through Astro, so nothing here touches them.
    csp: {
      directives: ["object-src 'none'", "frame-ancestors 'self'", "base-uri 'none'"],
      // Setting `resources` replaces the implicit `'self'`, so it has to be
      // spelled out. gtag.js is the only cross-origin script the site loads
      // (BaseHead, production only, and only when a measurement id is set);
      // its own collect calls are not restricted because no `default-src`
      // fallback is declared.
      scriptDirective: {
        resources: ["'self'", 'https://www.googletagmanager.com'],
        // Astro hashes the scripts it owns, but a `<script is:inline>` is
        // the author's to vouch for, so these two are listed by hand:
        //   - the pre-paint colour-mode swap in BaseHead (it must run
        //     synchronously before first paint, so it cannot be bundled)
        //   - the gtag config block in BaseHead (its id rides on a data
        //     attribute precisely so the body — and this hash — stay put)
        // Edit either body and the hash must be updated with it; the
        // `inline script hashes` case in tests/csp-inline-hashes.test.ts
        // fails loudly when the two drift apart.
        hashes: [
          'sha256-SvqhACN9/blyV175eywKTodB0BQ6+7BG84s2vKfW1Es=',
          'sha256-GrC8nqWdndno/KFAtswkxx0bI075CnHpTjW8mgcAvmw=',
        ],
      },
      // `'unsafe-inline'` on styles only, and on purpose: the theme colours
      // are injected per request from the site settings and ClientRouter
      // writes its own view-transition rules at runtime, so neither set of
      // bytes exists at build time to hash. Supplying it also suppresses
      // Astro's style hashes (a hash would override it per the CSP spec), so
      // this directive is the whole story for styles. Scripts stay strict.
      styleDirective: {
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  integrations: [react(), bundleSsrDepsForStandalone],
  vite: {
    plugins: [tailwindcss()],
    // Dev keeps the default dependency externalization — with `ssr.noExternal`
    // the Vite 8 module runner evaluates react's CJS entry as ESM and crashes
    // with "module is not defined" before the first request. The standalone
    // build re-adds the flag via the integration above.
    server: {
      // local.host is the dev domain (hosts-file alias for 127.0.0.1) so the
      // session cookie exercises its production domain-scoped shape; Vite's
      // DNS-rebinding guard 403s any Host outside this list by default.
      allowedHosts: ['local.host'],
    },
  },
});
