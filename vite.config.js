import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Корнем фронта будет gift-search-site/
  root: resolve(__dirname, 'gift-search-site'),

  server: {
    // Разрешаем читать файлы выше корня (для импорта ../data/index.js)
    fs: {
      allow: [__dirname],
    },
    port: 5173,
    open: true,
  },

  // Билд (на будущее): сложим собранное в /dist в корне
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
});
