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
    port: 4321,
  },
  // Configure scoped styles with a unique seed for this island
  scopedStyleStrategy: 'class',
  vite: {
    css: {
      // Add a fixed class name prefix for all styles in this island
      modules: {
        // Create a consistent, readable pattern for scoped class names
        // They will appear as 'systemhealth__className' in the DOM
        generateScopedName: 'systemhealth__[local]'
      }
    },
    server: {
      // Allow cross-origin requests
      cors: true
    }
  }
});
