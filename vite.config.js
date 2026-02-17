import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('firebase')) return 'firebase';
          if (id.includes('react-router-dom') || id.includes('react-router')) return 'router';
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('katex') || id.includes('react-katex')) return 'math';
          if (
            id.includes('@radix-ui') ||
            id.includes('lucide-react') ||
            id.includes('framer-motion')
          ) {
            return 'ui-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  resolve: {
    alias: {
      // This "@" shortcut is common in Hostinger/Shadcn projects
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
