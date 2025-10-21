import { defineConfig } from 'vite';
import { resolve } from 'path';
// === НОВОЕ: импорт для копирования файлов ===
import { copyFileSync } from 'fs';

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

  // === НОВОЕ: плагин для копирования out-of-stock.html ===
  plugins: [
    {
      name: 'copy-out-of-stock',
      writeBundle() {
        const src = resolve(__dirname, 'gift-search-site', 'out-of-stock.html');
        const dest = resolve(__dirname, 'dist', 'out-of-stock.html');
        try {
          copyFileSync(src, dest);
          console.log('✅ out-of-stock.html copied to dist/');
        } catch (err) {
          console.error('❌ Failed to copy out-of-stock.html:', err);
        }
      },
    },
  ],
});
