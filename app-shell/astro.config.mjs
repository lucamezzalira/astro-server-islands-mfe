// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  server: {
    port: 3030,
  },
  vite: {
    server: {
      // Allow cross-origin requests during development
      cors: true
    }
  }
});
