// vite.config.js
import { defineConfig } from "file:///C:/Users/Nazir%20Alabi/webdev/UQM/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Nazir%20Alabi/webdev/UQM/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { visualizer } from "file:///C:/Users/Nazir%20Alabi/webdev/UQM/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Nazir Alabi\\webdev\\UQM";
var vite_config_default = defineConfig(() => {
  const shouldAnalyze = process.env.ANALYZE === "true";
  return {
    plugins: [
      react(),
      shouldAnalyze ? visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        open: false
      }) : null
    ].filter(Boolean),
    build: {
      sourcemap: shouldAnalyze,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules"))
              return;
            if (id.includes("firebase"))
              return "firebase";
            if (id.includes("react-router-dom") || id.includes("react-router"))
              return "router";
            if (id.includes("react") || id.includes("scheduler"))
              return "react-vendor";
            if (id.includes("katex") || id.includes("react-katex"))
              return "math";
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("framer-motion")) {
              return "ui-vendor";
            }
            return "vendor";
          }
        }
      }
    },
    resolve: {
      alias: {
        // This "@" shortcut is common in Hostinger/Shadcn projects
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxOYXppciBBbGFiaVxcXFx3ZWJkZXZcXFxcVVFNXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxOYXppciBBbGFiaVxcXFx3ZWJkZXZcXFxcVVFNXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9OYXppciUyMEFsYWJpL3dlYmRldi9VUU0vdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tICdyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXInO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKCkgPT4ge1xuICBjb25zdCBzaG91bGRBbmFseXplID0gcHJvY2Vzcy5lbnYuQU5BTFlaRSA9PT0gJ3RydWUnO1xuXG4gIHJldHVybiB7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHNob3VsZEFuYWx5emVcbiAgICAgID8gdmlzdWFsaXplcih7XG4gICAgICAgICAgZmlsZW5hbWU6ICdkaXN0L3N0YXRzLmh0bWwnLFxuICAgICAgICAgIGd6aXBTaXplOiB0cnVlLFxuICAgICAgICAgIGJyb3RsaVNpemU6IHRydWUsXG4gICAgICAgICAgb3BlbjogZmFsc2UsXG4gICAgICAgIH0pXG4gICAgICA6IG51bGwsXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICBidWlsZDoge1xuICAgIHNvdXJjZW1hcDogc2hvdWxkQW5hbHl6ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKCFpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHJldHVybjtcblxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZmlyZWJhc2UnKSkgcmV0dXJuICdmaXJlYmFzZSc7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXItZG9tJykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LXJvdXRlcicpKSByZXR1cm4gJ3JvdXRlcic7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdCcpIHx8IGlkLmluY2x1ZGVzKCdzY2hlZHVsZXInKSkgcmV0dXJuICdyZWFjdC12ZW5kb3InO1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygna2F0ZXgnKSB8fCBpZC5pbmNsdWRlcygncmVhY3Qta2F0ZXgnKSkgcmV0dXJuICdtYXRoJztcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBpZC5pbmNsdWRlcygnQHJhZGl4LXVpJykgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdsdWNpZGUtcmVhY3QnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ2ZyYW1lci1tb3Rpb24nKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuICd1aS12ZW5kb3InO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiAndmVuZG9yJztcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAvLyBUaGlzIFwiQFwiIHNob3J0Y3V0IGlzIGNvbW1vbiBpbiBIb3N0aW5nZXIvU2hhZGNuIHByb2plY3RzXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcbiAgICB9LFxuICB9LFxufTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyUixTQUFTLG9CQUFvQjtBQUN4VCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsa0JBQWtCO0FBSDNCLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYSxNQUFNO0FBQ2hDLFFBQU0sZ0JBQWdCLFFBQVEsSUFBSSxZQUFZO0FBRTlDLFNBQU87QUFBQSxJQUNQLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxNQUNOLGdCQUNJLFdBQVc7QUFBQSxRQUNULFVBQVU7QUFBQSxRQUNWLFVBQVU7QUFBQSxRQUNWLFlBQVk7QUFBQSxRQUNaLE1BQU07QUFBQSxNQUNSLENBQUMsSUFDRDtBQUFBLElBQ04sRUFBRSxPQUFPLE9BQU87QUFBQSxJQUNoQixPQUFPO0FBQUEsTUFDTCxXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsUUFDYixRQUFRO0FBQUEsVUFDTixhQUFhLElBQUk7QUFDZixnQkFBSSxDQUFDLEdBQUcsU0FBUyxjQUFjO0FBQUc7QUFFbEMsZ0JBQUksR0FBRyxTQUFTLFVBQVU7QUFBRyxxQkFBTztBQUNwQyxnQkFBSSxHQUFHLFNBQVMsa0JBQWtCLEtBQUssR0FBRyxTQUFTLGNBQWM7QUFBRyxxQkFBTztBQUMzRSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxLQUFLLEdBQUcsU0FBUyxXQUFXO0FBQUcscUJBQU87QUFDN0QsZ0JBQUksR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsYUFBYTtBQUFHLHFCQUFPO0FBQy9ELGdCQUNFLEdBQUcsU0FBUyxXQUFXLEtBQ3ZCLEdBQUcsU0FBUyxjQUFjLEtBQzFCLEdBQUcsU0FBUyxlQUFlLEdBQzNCO0FBQ0EscUJBQU87QUFBQSxZQUNUO0FBRUEsbUJBQU87QUFBQSxVQUNUO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUE7QUFBQSxRQUVMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0EsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
