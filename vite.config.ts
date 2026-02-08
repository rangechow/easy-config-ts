/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

const projectRoot = __dirname;

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: path.join(projectRoot, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.join(projectRoot, 'dist/main'),
            rollupOptions: {
              external: ['electron', 'exceljs', 'js-yaml', 'chokidar'],
            },
          },
        },
      },
      {
        entry: path.join(projectRoot, 'src/preload/index.ts'),
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: path.join(projectRoot, 'dist/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.join(projectRoot, 'src/shared'),
    },
  },
  root: path.join(projectRoot, 'src/renderer'),
  build: {
    outDir: path.join(projectRoot, 'dist/renderer'),
  },
});
