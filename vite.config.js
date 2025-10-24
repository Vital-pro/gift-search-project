// vite.config.ts
// [ИЗМЕНЕНО] Переносим root на gift-search-site/, чтобы Vite видел index.html там.
// [ДОБАВЛЕНО] publicDir указываем относительно нового root → ../public
// [ИЗМЕНЕНО] outDir поднимаем на уровень выше → ../dist

import { defineConfig } from 'vite';

export default defineConfig({
  root: 'gift-search-site', // ← ТЕПЕРЬ корень сборки здесь (где index.html)
  publicDir: '../public', // ← статика из корня репо попадёт в dist/
  build: {
    outDir: '../dist', // ← собираем в корень репо: /dist
    emptyOutDir: true,
    target: 'es2020',
    cssTarget: 'chrome90',
    sourcemap: false,
    minify: 'esbuild',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
    open: false,
  },
});
