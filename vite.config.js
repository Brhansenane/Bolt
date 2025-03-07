import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: [
      'bolt-nhfd.onrender.com'
    ]
  }
});
