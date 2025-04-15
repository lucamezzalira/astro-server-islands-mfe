import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  server: {
    port: 4323,
  },
  vite: {
    envPrefix: 'VITE_',
    server: {
      watch: {
        ignored: ['**/.idea/**']
      }
    }
  }
}); 