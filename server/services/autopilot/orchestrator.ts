import { storage } from "../../storage";
import {
  extractPayStubData,
  extractBankStatementData,
  extractLeaseData,
  extractTaxReturnData,
  EXTRACTION_MODEL_ID,
  EXTRACTION_PROMPT_VERSION,
} from "../../extractionService";
import { recordCoarseExtraction } from "../documentConfidence";
import { logAiInteraction } from "../aiInteractionLog";
import { recalculateDecision } from "../decisionEngine";
import { evaluateBrokerSubmissionReadiness } from "../brokerSubmissionReadiness";
import {
  syncDocumentRequirements,
} from "../../pipelineEngine";
import { isAutopilotEnabled, canGenerateFollowUps } from "./config";
import { materializeFlagsToFollowUps } from "./followUps";
import { publishReviewing, publishCurrentStatus } from "./events";
import type { PreUwFlag } from "../preUnderwriting";
import type { LoanApplication, LoanCondition } from "@shared/schema";
import { toNum } from "@shared/lib/number";

/**
 * Autopilot document orchestrator — the always-on agent's reaction to a borrower
 * document upload. Chains the pieces that already exist into one event-driven
 * pass:
 *
 *   PERCEIVE  — extract via the Claude vendor adapter (server/extractionService),
 *               record confidence, stage the document (MR-2: never auto-verify),
 *               and log the model call to ai_interactions.
 *   RECONCILE — compute the stated-vs-documented income delta for narration
 *               (Phase 1 narrates it; canonical writeback is a later phase gated
 *               by canUpdateApplicationData()).
 *   COGNIZE   — refresh the pre-qualification snapshot (recalculateDecision).
 *               Broker pre-qual, NOT a credit decision — the lender decides.
 *   ACT       — materialize cited package-gap follow-ups from the file's flags,
 *               re-check lender-readiness, and narrate one rich activity entry.
 *
 * Runs detached (best-effort on serverless, like the prior auto-extract IIFE it
 * replaces). Never throws — every step is guarded so a failure can't take down
 * the upload request that spawned it.
 */

export interface AutopilotDocumentParams {
  applicationId: string;
  documentId: string;
  documentType: string;
  storagePath: string;
  fileSize?: number | null;
  triggeredBy: string;
}

interface ExtractionOutcome {
  confidence: "high" | "medium" | "low";
  extractedFields: string[];
  warnings?: string[];
  modelId?: string;
  /** Human-readable narration lines derived from the extraction. */
  highlights: string[];
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString()}`;

const prettyDocType = (t: string): string =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Dispatch extraction by document type, returning normalized fields + narration
 * highlights. Returns null for types with no extractor (e.g. government_id) —
 * the run still narrates the upload and materializes follow-ups.
 */
async function extractByType(
  documentType: string,
  storagePath: string,
  app: LoanApplication,
): Promise<ExtractionOutcome | null> {
  const highlights: string[] = [];
  switch (documentType) {
    case "pay_stub": {
      const e = await extractPayStubData(storagePath);
      if (e.employerName) highlights.push(`Employer: ${e.employerName}`);
      if (e.grossPay != null) highlights.push(`Gross pay (period): ${usd(e.grossPay)}`);
      if (e.ytdGross != null) highlights.push(`YTD gross: ${usd(e.ytdGross)}`);
      return { confidence: e.confidence, extractedFields: e.extractedFields, warnings: e.warnings, modelId: e.modelId, highlights };
    }
    case "tax_return": {
      const e = await extractTaxReturnData(storagePath);
      if (e.taxpayerName) highlights.push(`Taxpayer: ${e.taxpayerName}`);
      const observedAnnual = e.w2Wages ?? e.grossIncome ?? e.adjustedGrossIncome;
      if (observedAnnual != null) {
        const stated = toNum(app.annualIncome);
        if (!isNaN(stated) && stated > 0) {
          const delta = observedAnnual - stated;
          highlights.push(
            `Stated ${usd(stated)} vs documented ${usd(observedAnnual)} (${delta >= 0 ? "+" : "-"}${usd(Math.abs(delta))}).`,
          );
        } else {
          highlights.push(`Documented annual income: ${usd(observedAnnual)}`);
        }
      }
      if (e.scheduleC?.netProfitLoss != null) highlights.push(`Schedule C net profit: ${usd(e.scheduleC.netProfitLoss)}`);
      return { confidence: e.confidence, extractedFields: e.extractedFields, warnings: e.warnings, modelId: e.modelId, highlights };
    }
    case "bank_statement": {
      const e = await extractBankStatementData(storagePath);
      if (e.closingBalance != null) highlights.push(`Closing balance: ${usd(e.closingBalance)}`);
      if (e.totalDeposits != null) highlights.push(`Total deposits: ${usd(e.totalDeposits)}`);
      return { confidence: e.confidence, extractedFields: e.extractedFields, warnings: e.warnings, modelId: e.modelId, highlights };
    }
    case "lease_agreement": {
      const e = await extractLeaseData(storagePath);
      return { confidence: e.confidence, extractedFields: e.extractedFields, warnings: e.warnings, modelId: e.modelId, highlights };
    }
    default:
      return null;
  }
}

function buildNarration(p: {
  outcome: ExtractionOutcome | null;
  extractionFailed: boolean;
  createdFollowUps: string[];
  readinessLine: string | null;
}): string {
  const parts: string[] = [];
  if (p.outcome) {
    parts.push(
      p.outcome.highlights.length
        ? p.outcome.highlights.join(" · ")
        : `Parsed ${p.outcome.extractedFields.length} field(s) (confidence: ${p.outcome.confidence}).`,
    );
    if (p.outcome.warnings?.length) parts.push(`Notes: ${p.outcome.warnings.join("; ")}.`);
  } else if (p.extractionFailed) {
    parts.push("Document received; automated parsing was unavailable for this file.");
  } else {
    parts.push("Document received and filed.");
  }
  if (p.createdFollowUps.length) {
    parts.push(`Created ${p.createdFollowUps.length} follow-up(s): ${p.createdFollowUps.join(", ")}.`);
  }
  if (p.readinessLine) parts.push(p.readinessLine);
  return parts.join(" ");
}

/**
 * Autopilot section-completion reaction (Phase 3) — the proactive needs list.
 *
 * The moment a borrower saves their URLA/intake sections, generate the initial
 * document needs from their STATED data (before any upload), so the dead time
 * between "submitted" and "here's what we need" disappears. Reuses the
 * deterministic requirement rules (pipelineEngine.determineDocumentRequirements)
 * and the now-idempotent condition generator, so re-saves and the later intake
 * pipeline init converge on one set instead of duplicating. Narrates only when
 * new needs were added, to stay quiet on no-op re-saves. Never throws.
 */
export async function runAutopilotForSection(params: {
  applicationId: string;
  triggeredBy: string;
  /**
   * Conditions the caller's own (ungated) requirement sync just created.
   * Passed in so the derivation runs ONCE per save: the deterministic half is
   * no longer autopilot's job, but autopilot still narrates what it produced.
   */
  createdConditions?: LoanCondition[];
}): Promise<void> {
  const { applicationId } = params;
  try {
    const application = await storage.getLoanApplication(applicationId);
    if (!application) return;
    if (!(await isAutopilotEnabled(application.loanOfficerId))) return;
    if (!(await canGenerateFollowUps())) return;

    // The requirement sync is deterministic and runs whether or not autopilot
    // is on (server/pipelineEngine.ts syncDocumentRequirements). Re-derive only
    // when the caller did not already do it, so a save never derives twice.
    const created =
      params.createdConditions ?? (await syncDocumentRequirements(application)).created;

    // Refresh the pre-qualification snapshot from the newly-stated data.
    await recalculateDecision(applicationId, "autopilot_section");

    if (created.length === 0) return; // idempotent no-op → don't narrate

    let readinessLine: string | null = null;
    try {
      const readiness = await evaluateBrokerSubmissionReadiness(applicationId);
      readinessLine = readiness.readyToSubmitToLender
        ? "File is packaging-complete — ready to submit to a wholesale lender."
        : `${readiness.nextActions.length} item(s) remain before this file is lender-ready.`;
    } catch {
      /* readiness is advisory */
    }

    const needsList = created.map((c) => c.title).slice(0, 8).join(", ");
    await storage.createDealActivity({
      applicationId,
      activityType: "autopilot_review",
      title: "Autopilot built your document needs list",
      description:
        `Based on your stated details, we'll need ${created.length} item(s): ${needsList}.` +
        (readinessLine ? ` ${readinessLine}` : ""),
      performedBy: application.userId,
    });
  } catch (err) {
    console.error(`[Autopilot] Section run failed for ${params.applicationId} (non-fatal):`, err);
  }
}

export async function runAutopilotForDocument(params: AutopilotDocumentParams): Promise<void> {
  const { applicationId, documentId, documentType, storagePath, fileSize, triggeredBy } = params;
  const startedAt = Date.now();
  try {
    const application = await storage.getLoanApplication(applicationId);
    if (!application) return;

    // Defensive re-check of the kill switch + pilot allowlist (the caller also
    // gates; this makes the orchestrator safe to invoke from anywhere).
    if (!(await isAutopilotEnabled(application.loanOfficerId))) return;

    // Live banner: flip the borrower's status to "We're reviewing your
    // information…" for anyone watching the SSE stream in this process.
    await publishReviewing(applicationId);

    // 1. PERCEIVE (+ 2. RECONCILE narration) ---------------------------------
    let outcome: ExtractionOutcome | null = null;
    let extractionFailed = false;
    try {
      outcome = await extractByType(documentType, storagePath, application);
    } catch (err) {
      extractionFailed = true;
      console.error(`[Autopilot] Extraction failed for ${documentId} (non-fatal):`, err);
    }

    if (outcome) {
      const { humanReviewRequired } = await recordCoarseExtraction({
        documentId,
        documentType,
        applicationId,
        confidence: outcome.confidence,
        extractedFields: outcome.extractedFields,
        fileSize: fileSize ?? undefined,
      });
      await storage.updateDocument(documentId, {
        // MR-2: a doc that clears the review threshold is staged "verifying" for a
        // human to confirm; AI confidence never auto-sets "verified".
        status: !humanReviewRequired ? "verifying" : "uploaded",
        notes: JSON.stringify({
          extractedAt: new Date().toISOString(),
          extractedFields: outcome.extractedFields,
          confidence: outcome.confidence,
          humanReviewRequired,
          warnings: outcome.warnings,
          modelId: outcome.modelId ?? EXTRACTION_MODEL_ID,
        }),
      });

      // Governance: extraction previously logged only to the document row.
      await logAiInteraction({
        applicationId,
        userId: triggeredBy,
        workflow: "autopilot_extraction",
        provider: "claude",
        model: outcome.modelId ?? EXTRACTION_MODEL_ID,
        systemPrompt: EXTRACTION_PROMPT_VERSION,
        prompt: `Autopilot document extraction: ${documentType} (${documentId})`,
        response: outcome.extractedFields.join(", "),
        classification: "internal_only",
        latencyMs: Date.now() - startedAt,
      });
    }

    // 3. COGNIZE — refresh the pre-qualification snapshot (append-only, safe). --
    await recalculateDecision(applicationId, "autopilot_document");

    // 4. ACT — give the file's current flags teeth (cited package follow-ups). -
    let createdFollowUps: string[] = [];
    const flags = (application.preUwFlags as { flags?: PreUwFlag[] } | null)?.flags ?? [];
    if (flags.length > 0 && (await canGenerateFollowUps())) {
      const res = await materializeFlagsToFollowUps(applicationId, flags);
      createdFollowUps = res.created;
    }

    // 5. Re-check how close the file is to lender-ready (advisory). ------------
    let readinessLine: string | null = null;
    try {
      const readiness = await evaluateBrokerSubmissionReadiness(applicationId);
      readinessLine = readiness.readyToSubmitToLender
        ? "File is packaging-complete — ready to submit to a wholesale lender."
        : `${readiness.nextActions.length} item(s) remain before this file is lender-ready.`;
    } catch {
      /* readiness is advisory; never block narration on it */
    }

    // 6. NARRATE — one rich activity-feed entry (LO Timeline + borrower file). --
    await storage.createDealActivity({
      applicationId,
      activityType: "autopilot_review",
      title: `Autopilot reviewed ${prettyDocType(documentType)}`,
      description: buildNarration({ outcome, extractionFailed, createdFollowUps, readinessLine }),
      performedBy: application.userId,
    });

    // 7. Live banner: push the result state ("Looks good!" / "A few items
    // needed.") to anyone watching the borrower's SSE stream.
    await publishCurrentStatus(applicationId);
  } catch (err) {
    console.error(`[Autopilot] Document run failed for ${params.documentId} (non-fatal):`, err);
  }
}
