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
    include: [
      "tests/lookupResolver.test.ts",
      "tests/mismoValidation.test.ts",
      "tests/preApprovalMachine.test.ts",
      "tests/preUnderwriting.test.ts",
      "tests/lifecycleEngine.test.ts",
      "tests/underwritingNuance.test.ts",
      "tests/complianceInvariants.test.ts",
      "tests/scenarioCatalog.test.ts",
      "tests/stageRequirements.test.ts",
      "tests/borrowerStateMachine.test.ts",
    ],
    // Some modules under test transitively import server/db.ts, which refuses to
    // boot without a DATABASE_URL. Unit tests never touch the database, so a
    // placeholder keeps them hermetic (no .env or real database needed).
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://unit-tests:placeholder@localhost:5432/unit_tests_never_connects",
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
