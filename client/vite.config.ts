import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-motion':   ['framer-motion'],
          'vendor-charts':   ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui':       ['lucide-react', 'zustand'],
        },
      },
    },
  },
});
