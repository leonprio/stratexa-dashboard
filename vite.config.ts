import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = new URL('.', import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    cacheDir: '.vite-cache',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
          '@': path.resolve(projectRoot),
      }
    },
    build: {
      outDir: 'build_output',
      emptyOutDir: true
    }
  };
});
