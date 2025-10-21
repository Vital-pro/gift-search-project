import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  root: resolve(__dirname, 'gift-search-site'),

  server: {
    fs: {
      allow: [__dirname],
    },
    port: 5173,
    open: true,
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`,
      },
    },
  },

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
