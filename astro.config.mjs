// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'static', // Static pages by default; API routes use `prerender = false`
  adapter: node({ mode: 'standalone' }),
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()]
  }
});