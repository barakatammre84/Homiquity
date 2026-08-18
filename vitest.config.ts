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
      "tests/amortization.test.ts",
      "tests/livenessProbe.test.ts",
      "tests/cronSchedules.test.ts",
      // The CI trigger surface. A `branches:` filter under pull_request means a
      // stacked PR gets zero check-runs while still reporting mergeStateStatus CLEAN.
      "tests/ciTriggers.test.ts",
      "tests/accessControl.test.ts",
      "tests/commitmentLetterProvenance.test.ts",
      "tests/uploadsUnavailableCopy.test.ts",
      "tests/liveCreditPullImport.test.ts",
      "tests/creditVendorInterlock.test.ts",
      "tests/clientIp.test.ts",
      "tests/securityHeaders.test.ts",
      "tests/cspViolationReport.test.ts",
      "tests/canonicalHost.test.ts",
      "tests/zodSchemaSemantics.test.ts",
      "tests/routeGates.test.ts",
      "tests/queryErrorHandling.test.ts",
      "tests/activeApplicationListParity.test.ts",
      "tests/apiRequestConvergence.test.ts",
      "tests/queryKeyConvergence.test.ts",
      "tests/clientSchemaImports.test.ts",
      "tests/borrowerTaskView.test.ts",
      "tests/borrowerDocumentView.test.ts",
      "tests/borrowerActivityView.test.ts",
      "tests/rateProductHeadings.test.ts",
      "tests/migrationLedgerGuard.test.ts",
      "tests/securityReviewGuard.test.ts",
      "tests/userPhones.test.ts",
      "tests/dependabotReactGrouping.test.ts",
      "tests/loCommsLint.test.ts",
      "tests/borrowerConditionView.test.ts",
      "tests/loanProducts.test.ts",
      "tests/loCompensation.test.ts",
      "tests/compensationElectionQmGate.test.ts",
      "tests/platformFeeSchedule.test.ts",
      "tests/feeTolerance.test.ts",
      "tests/rateLockConfirmation.test.ts",
      "tests/leDisclosureBaseline.test.ts",
      "tests/counterpartyAndCompensation.test.ts",
      "tests/lenderApprovalControl.test.ts",
      "tests/compensationClawback.test.ts",
      "tests/revenueRecognition.test.ts",
      "tests/costEntryDisclosureImpact.test.ts",
      "tests/commissionPayout.test.ts",
      "tests/feeProvenanceAndCosts.test.ts",
      "tests/leDisclosedFeeProvenance.test.ts",
      "tests/nPlusOneBatching.test.ts",
      "tests/complaintEscalation.test.ts",
      "tests/cycleTimeReport.test.ts",
      "tests/ruleEngine.test.ts",
      "tests/decisionEngineGaps.test.ts",
      // WF1-002: the engine's compensation-independent pricing projection.
      "tests/paymentProjection.test.ts",
      // ARC-3: the borrower-facing what-if, on the SAME derivation as the LE.
      "tests/borrowerWhatIf.test.ts",
      // WF2-F4: the URLA section-4a loanDetails write path.
      "tests/urlaLoanDetailsSave.test.ts",
      // The three wire states of an intake field (absent / present / null =
      // clear), and the proof the AI coach can never reach the clear.
      "tests/intakeClearSemantics.test.ts",
      "tests/pipelineEngineStageTransitions.test.ts",
      "tests/activeBuyerPromotion.test.ts",
      "tests/docRequestDraft.test.ts",
      "tests/funnelDraftPersistence.test.ts",
      "tests/adminPredicate.test.ts",
      "tests/extensionFeeAndRegZBasis.test.ts",
      "tests/contingentLiabilities.test.ts",
      "tests/businessChannel.test.ts",
      "tests/scenarioSimulator.test.ts",
      "tests/cockpitScoping.test.ts",
      "tests/signalEngine.test.ts",
      "tests/adversarialPersonas.test.ts",
      "tests/adverseActionNotice.test.ts",
      "tests/adverseActionDelivery.test.ts",
      "tests/adverseActionPdf.test.ts",
      "tests/adverseActionFcraChokepoint.test.ts",
      "tests/adverseActionPregenerateHardening.test.ts",
      "tests/apr.test.ts",
      "tests/aprValidation.test.ts",
      "tests/structureTranslation.test.ts",
      "tests/encryptionRotation.test.ts",
      "tests/fairLendingAnalysis.test.ts",
      "tests/trid.test.ts",
      "tests/documentNotesTrustBoundary.test.ts",
      "tests/creditConsentScope.test.ts",
      "tests/creditSimulationGuards.test.ts",
      "tests/kycClearanceWorkflow.test.ts",
      "tests/onboardingProfileAttestation.test.ts",
      // Revised-LE deadline math (Reg Z §1026.19(e)(4)(i)) — sibling of trid.test.ts.
      // Was in NEITHER config since it landed, so its 10 assertions had never run
      // (same class as F-013's maintenanceMode.test.ts). Pure unit test: no HTTP, no DB.
      "tests/changeOfCircumstance.test.ts",
      "tests/lookupResolver.test.ts",
      "tests/mismoValidation.test.ts",
      "tests/preApprovalMachine.test.ts",
      "tests/letterIntegrity.test.ts",
      "tests/preUnderwriting.test.ts",
      "tests/lifecycleEngine.test.ts",
      "tests/underwritingNuance.test.ts",
      "tests/incomeOrchestrator.test.ts",
      "tests/incomeCutoverParity.test.ts",
      "tests/nonQmProgramGate.test.ts",
      "tests/halalLaneGate.test.ts",
      "tests/accuracyLoop.test.ts",
      "tests/underwritingEdgeCases.test.ts",
      "tests/selfEmploymentIncome.test.ts",
      "tests/complianceInvariants.test.ts",
      "tests/scenarioCatalog.test.ts",
      "tests/statusVocabulary.test.ts",
      "tests/borrowerJourney.test.ts",
      "tests/routeGateDrift.test.ts",
      "tests/intakeSchema.test.ts",
      "tests/illinoisDpaSeed.test.ts",
      "tests/stageRequirements.test.ts",
      "tests/fileHealth.test.ts",
      "tests/borrowerStateMachine.test.ts",
      "tests/ssnVault.test.ts",
      "tests/loginLockout.test.ts",
      "tests/socialAuthProviders.test.ts",
      "tests/marketDataParsers.test.ts",
      "tests/valueEstimate.test.ts",
      "tests/propertyEligibility.test.ts",
      "tests/errorMessage.test.ts",
      "tests/mismoMersMin.test.ts",
      "tests/mismoExport.test.ts",
      "tests/quietHours.test.ts",
      "tests/mcpAudit.test.ts",
      "tests/mcpAgentIdentity.test.ts",
      // F-042: the soft-pull tool's FCRA gate runs BEFORE the cached-pull
      // read, and the consent's type must cover the pull.
      "tests/mcpSoftPullGate.test.ts",
      "tests/smsCompliance.test.ts",
      // X-Twilio-Signature verification on the inbound SMS webhook — pins the
      // algorithm against Twilio's published test vector and the route's
      // fail-closed posture.
      "tests/twilioWebhookSignature.test.ts",
      // Outbound delivery receipts: that ONLY error 21610 converges the opt-out
      // ledger, and that the status callback authenticates against its OWN URL.
      "tests/twilioMessageStatus.test.ts",
      "tests/errorMonitoring.test.ts",
      "tests/auditReanchor.test.ts",
      "tests/auditChainTruncation.test.ts",
      "tests/qmThresholds.test.ts",
      "tests/specialFeatureCodes.test.ts",
      "tests/loanDeliveryEdits.test.ts",
      "tests/brokerSubmissionReadiness.test.ts",
      "tests/incomeAnalysisPackage.test.ts",
      "tests/borrowerIncomeView.test.ts",
      "tests/lenderSubmission.test.ts",
      "tests/pipelineEngineDocumentRequirements.test.ts",
      "tests/leadNotifications.test.ts",
      "tests/uploadsPresignedOnly.test.ts",
      "tests/rateLimitRelaxed.test.ts",
      "tests/betaGate.test.ts",
      "tests/prelaunchGate.test.ts",
      "tests/prelaunchPublicSurface.test.ts",
      "tests/taxInsight.test.ts",
      "tests/extractionService.test.ts",
      "tests/taxDocumentIntelligence.test.ts",
      "tests/taxReconciliation.test.ts",
      "tests/situationClassifier.test.ts",
      "tests/readinessReconciliation.test.ts",
      "tests/documentFacts.test.ts",
      "tests/readinessSelfAttestation.test.ts",
      "tests/extractionReadinessWiring.test.ts",
      "tests/documentConfidence.test.ts",
      "tests/documentReview.test.ts",
      "tests/cpaPartners.test.ts",
      "tests/partnerProfiles.test.ts",
      "tests/mismoXsdValidation.test.ts",
      "tests/approvalStrength.test.ts",
      "tests/buyingPowerEstimate.test.ts",
      "tests/loanScenarioMatrix.test.ts",
      "tests/pricingAdapterMI.test.ts",
      "tests/loanEstimateMI.test.ts",
      "tests/documentTypeAliases.test.ts",
      "tests/localObjectStorage.test.ts",
      "tests/postAuthRoute.test.ts",
      "tests/borrowerOfferView.test.ts",
      "tests/queryParams.test.ts",
      "tests/spaCatchAll.test.ts",
      "tests/seoPrerender.test.ts",
      "tests/coachProfileSync.test.ts",
      "tests/coachTools.test.ts",
      "tests/coachLintFilter.test.ts",
      "tests/coachSse.test.ts",
      "tests/autopilotFollowUps.test.ts",
      "tests/autopilotAusFollowUps.test.ts",
      "tests/autopilotDecisionRelay.test.ts",
      "tests/autopilotConsole.test.ts",
      "tests/riskBrief.test.ts",
      "tests/sensitiveInputGuard.test.ts",
      "tests/licensedStates.test.ts",
      "tests/documentStatus.test.ts",
      "tests/documentReviewNotifications.test.ts",
      "tests/documentConditionRevert.test.ts",
      "tests/documentTaskOwnerRole.test.ts",
      "tests/taskCancellation.test.ts",
      "tests/taskEngineSlaSeed.test.ts",
      "tests/uploadValidation.test.ts",
      "tests/documentChecklist.test.ts",
      "tests/documentUploadTerminalGuard.test.ts",
      "tests/complianceScore.test.ts",
      // Appended at the END, not at the top anchor. #440 and #443 both went
      // stale without merging because every concurrent PR inserted its entry
      // just after "tests/accessControl.test.ts", so each one conflicted with
      // whichever sibling merged first. The list is an explicit allowlist by
      // design — an unlisted test file is silently never run — so the fix is
      // to stop contending for one line, not to replace it with a glob.
      "tests/emailProviderObservability.test.ts",
      // The zod ↔ @hookform/resolvers pairing. A mismatch there turns every
      // failed validation into an unhandled rejection instead of a form error,
      // which deadens submit/continue buttons app-wide with no visible symptom.
      // Pure unit test: no HTTP, no DB.
      "tests/formResolverContract.test.ts",
      // Rent reporting, Phase 0. metro2Gate is the self-releasing citation gate on the
      // fixed-width compiler (sibling of nonQmProgramGate); rentFurnishing pins the
      // provenance gate, the queue state machine, and that billing stays off.
      "tests/metro2Gate.test.ts",
      "tests/rentFurnishing.test.ts",
      "tests/creditMonitoring.test.ts",
      "tests/rentReportingSurface.test.ts",
      // Lease capture: the encryption round-trip, the view's refusal to leak ciphertext,
      // UTC date semantics, and the validation boundary.
      "tests/leaseCapture.test.ts",
      // The rent surfaces' inbound paths — both routes shipped as orphans (2026-08-17
      // audit); deleting a nav link is silent, so the links are pinned.
      "tests/rentNavigation.test.ts",
      "tests/urlaRowContent.test.ts",
      "tests/urlaCoApplicantRemoval.test.ts",
      // CTO_ROADMAP §3.2 — the compliance dashboard's per-application MISMO
      // validation, now batched. Pins that the batched loader and the
      // single-application one produce IDENTICAL verdicts.
      "tests/mismoValidationBatch.test.ts",
      "tests/inviteValidateAudit.test.ts",
      "tests/mutationErrorHandling.test.ts",
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
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
});
