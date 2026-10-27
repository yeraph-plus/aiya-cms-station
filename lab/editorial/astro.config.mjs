// Implementation-reference preview for the editorial skin (docs/EDITORIAL.md).
//
// Deliberately NOT part of the app: `lab/editorial` is its own Astro project —
// its own `src/pages`, `public`, output, dev lock and dependency cache — so it
// can run alongside the site's `npm run dev` (4397 vs 4399), and the site build
// never sees it. It imports the real components and styles from the app's `src`
// through the alias below; that is the point of a reference page.
//
//   cd lab/editorial
//   npx astro dev                      # → http://localhost:4397
//
// Astro resolves the project root from the current directory (there is no
// `--root` flag in v7), which is why the preview is started from its own folder
// and not through `--config` at the repo root.
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const labRoot = fileURLToPath(new URL('.', import.meta.url));
const srcRoot = fileURLToPath(new URL('../../src', import.meta.url));
const modulesRoot = fileURLToPath(new URL('../../node_modules', import.meta.url));

export default defineConfig({
  srcDir: './src',
  publicDir: './public',
  outDir: './.dist',
  server: { port: 4397, strictPort: true },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // The preview imports `../../src` (components, tokens, fonts) and the React
    // renderer lives in the repo's `node_modules`; Vite's dev server only serves
    // files inside its root unless they are allowed here. Without
    // node_modules the islands' renderer is blocked and nothing hydrates.
    server: { fs: { allow: [labRoot, srcRoot, modulesRoot] } },
    resolve: { alias: { '@': srcRoot } },
  },
});
