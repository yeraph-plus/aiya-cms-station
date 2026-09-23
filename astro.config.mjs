import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// SSR everywhere (SEO), node standalone runtime. trailingSlash stays
// 'ignore' (not 'always') so file-like /media/ paths and dot segments never
// 404 at the router; the canonical slash shape is enforced by the
// middleware's 308 normalization instead. The backend DTO `url` fields
// already carry their trailing slash.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
