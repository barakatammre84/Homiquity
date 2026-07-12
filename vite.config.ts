import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Concurrent dev servers on this checkout (multiple Claude/dev sessions) race
  // on the shared node_modules/.vite dep cache and corrupt each other's
  // optimized chunks ("Invalid hook call" / two copies of React). A session can
  // opt into a private cache with VITE_CACHE_DIR; default behavior is unchanged.
  ...(process.env.VITE_CACHE_DIR ? { cacheDir: path.resolve(process.env.VITE_CACHE_DIR) } : {}),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own long-cached chunk so
        // an app deploy doesn't invalidate the React/Query download. framer-
        // motion is deliberately NOT pinned here — it stays in the async page
        // chunks that use it, off the initial load path.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "wouter"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
