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
      "tests/accessControl.test.ts",
      "tests/adversarialPersonas.test.ts",
      "tests/adverseActionNotice.test.ts",
      "tests/apr.test.ts",
      "tests/aprValidation.test.ts",
      "tests/encryptionRotation.test.ts",
      "tests/fairLendingAnalysis.test.ts",
      "tests/trid.test.ts",
      "tests/lookupResolver.test.ts",
      "tests/mismoValidation.test.ts",
      "tests/preApprovalMachine.test.ts",
      "tests/preUnderwriting.test.ts",
      "tests/lifecycleEngine.test.ts",
      "tests/underwritingNuance.test.ts",
      "tests/underwritingEdgeCases.test.ts",
      "tests/complianceInvariants.test.ts",
      "tests/scenarioCatalog.test.ts",
      "tests/statusVocabulary.test.ts",
      "tests/intakeSchema.test.ts",
      "tests/stageRequirements.test.ts",
      "tests/fileHealth.test.ts",
      "tests/borrowerStateMachine.test.ts",
      "tests/ssnVault.test.ts",
      "tests/loginLockout.test.ts",
      "tests/marketDataParsers.test.ts",
      "tests/valueEstimate.test.ts",
      "tests/propertyEligibility.test.ts",
      "tests/errorMessage.test.ts",
      "tests/mismoMersMin.test.ts",
      "tests/mismoExport.test.ts",
      "tests/quietHours.test.ts",
      "tests/mcpAudit.test.ts",
      "tests/mcpAgentIdentity.test.ts",
      "tests/smsCompliance.test.ts",
      "tests/errorMonitoring.test.ts",
      "tests/auditReanchor.test.ts",
      "tests/qmThresholds.test.ts",
      "tests/specialFeatureCodes.test.ts",
      "tests/loanDeliveryEdits.test.ts",
      "tests/brokerSubmissionReadiness.test.ts",
      "tests/lenderSubmission.test.ts",
      "tests/uploadsPresignedOnly.test.ts",
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
