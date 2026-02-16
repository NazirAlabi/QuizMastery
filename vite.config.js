import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This "@" shortcut is common in Hostinger/Shadcn projects
      "@": path.resolve(__dirname, "./src"),
    },
  },
});