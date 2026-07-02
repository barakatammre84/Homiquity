import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
    // Unit / logic tests. Pure in-process logic — no running HTTP server and no
    // database required. Everything that makes network calls to the app lives in
    // vitest.integration.config.ts instead.
    include: ["tests/lookupResolver.test.ts", "tests/mismoValidation.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
