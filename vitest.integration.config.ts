import { defineConfig } from "vitest/config";
import path from "path";

// Integration tests. These hit a *running* HTTP server over the network
// (default http://localhost:5000, override with TEST_BASE_URL). Start the
// server first (npm run build && npm start, or npm run dev) before running:
//
//   TEST_BASE_URL=http://localhost:5001 npm run test:integration
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
    include: [
      "tests/api.test.ts",
      "tests/authRecovery.test.ts",
      "tests/leads.test.ts",
      "tests/lookupMatrixCoverageGap.test.ts",
      "tests/lookupMatrixLifecycle.test.ts",
      "tests/loCommandCenter.test.ts",
      "tests/intakeHandoff.test.ts",
      "tests/rateLocks.test.ts",
      "tests/lenderConditions.test.ts",
      "tests/cocRoutes.test.ts",
      "tests/mismoExportAccess.test.ts",
      "tests/roleSeparation.test.ts",
      "tests/pricingUnderwriting.test.ts",
      "tests/taxInsightRoutes.test.ts",
      "tests/cpaPartnerRoutes.test.ts",
      "tests/partnerRoutes.test.ts",
      "tests/partnerConsent.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
