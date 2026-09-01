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
        // FUNCTION FORM, not the object form. vite 8 removes the object
        // form entirely (`'"react-vendor"' does not exist in type
        // ManualChunksFunction`), so this is the shape that survives the
        // upgrade — and it is written to reproduce the object form's output
        // exactly, verified by diffing built chunk sizes, not by reading it.
        //
        // The rule the object form encoded, and the reason it is subtle:
        // "react-dom/client" had to be listed EXPLICITLY there, because rollup
        // matched entries by resolved module id and client/src/main.tsx imports
        // `react-dom/client` — a different module from `react-dom`, which
        // nothing imports directly. Listing only "react-dom" left the whole
        // renderer (~180 kB raw) in the entry chunk while react-vendor emitted
        // just 17 kB, so the caching win was not being collected at all.
        //
        // Matching on the node_modules PATH removes that trap rather than
        // re-encoding it: `/react-dom/` covers react-dom and react-dom/client
        // alike. `scheduler` is listed because it is react-dom's own runtime
        // dependency — the object form pulled it in implicitly as part of the
        // dependency subgraph, and a path match would otherwise leave it in the
        // entry chunk. That is the one thing the two forms do not share, and it
        // is why this was verified against a build rather than assumed.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/.test(id)) {
            return "react-vendor";
          }
          if (/[\\/]node_modules[\\/]@tanstack[\\/](react-)?query(-core)?[\\/]/.test(id)) {
            return "query-vendor";
          }
          return undefined;
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
