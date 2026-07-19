import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Client component-test lane (adjudication log 2026-07-19 §4, intervention #1).
// Runs React components in happy-dom against the data-testid substrate — no
// dev server, no browser, no database. Part of `pnpm test`, so the CI gate
// catches UI regressions; live browser verification remains for genuinely
// visual/E2E acceptance (TEAM_PRACTICES §5.4).
//
// Include is a GLOB on purpose: a colocated *.test.tsx can never be silently
// stranded outside an include list (the trap CICD.md documents for the node
// configs). Server/logic tests stay in vitest.config.ts's explicit list.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // also enables @testing-library/react auto-cleanup
    environment: "happy-dom",
    testTimeout: 15000,
    include: ["client/src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
});
