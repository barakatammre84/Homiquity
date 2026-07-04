/**
 * Broker submission workflow — the operational pipeline for getting a loan
 * file from intake to a wholesale-lender submission.
 *
 * Homiquity operates as a BROKER: we originate and package the file; the
 * wholesale lender underwrites, closes, and (if selling to Fannie Mae) runs
 * loan delivery. The stages below reflect that division of labor:
 *
 *   1. intake            — URLA gating sections, TRID clock, e-disclosure
 *   2. aus               — DU submission gate + findings captured
 *   3. lenderPackage     — MISMO export validity, outstanding docs, QM
 *                          pre-flight, anti-steering disclosure (Reg Z
 *                          §1026.36(e)(3)) before options are locked
 *   4. deliveryPreflight — the Fannie Mae Loan Delivery / UCD / EarlyCheck
 *                          edit mirror (shared/fannieMae/) run as a lender's-
 *                          eye view of the file. INFORMATIONAL for a broker:
 *                          closing data belongs to the lender, so this stage
 *                          never blocks submission — it predicts what the
 *                          lender's own delivery checks will say.
 *
 * The stage derivation is a pure function (deriveSubmissionStages) so the
 * workflow decisions are unit-testable without a database.
 */

import { storage } from "../storage";
import { hasBorrowerConsent } from "../consentGate";
import { validateULDDCompliance, type ULDDValidationResult, type MISMOLoanDTO } from "../mismo";
import type { LoanDeliveryEditResult } from "@shared/fannieMae/loanDeliveryEdits";

export type StageStatus = "ready" | "blocked" | "attention" | "not_applicable";

export interface SubmissionStage {
  key: "intake" | "aus" | "lenderPackage" | "deliveryPreflight";
  label: string;
  status: StageStatus;
  blockers: string[];
  warnings: string[];
}

export interface BrokerSubmissionReadiness {
  applicationId: string;
  /** True when stages 1–3 are all ready: the file can go to a wholesale lender. */
  readyToSubmitToLender: boolean;
  currentStage: SubmissionStage["key"];
  stages: SubmissionStage[];
  nextActions: string[];
}

/** The URLA-validation subset the stage logic reads (from mismoValidation). */
export interface StageDerivationInputs {
  urla: {
    gseGatingFailed: boolean;
    criticalErrors: string[];
    missingDocuments: string[];
    qmStatus: "QM" | "Non-QM" | "Unknown";
    pointsAndFeesCompliant: boolean;
    tridStatus: {
      leRequired: boolean;
      leDueDate: Date | null;
      leIssued: boolean;
    };
  };
  uldd: Pick<ULDDValidationResult, "valid" | "errors" | "warnings">;
  aus: {
    casefileId: string | null;
    recommendation: string | null;
  };
  consents: {
    eDisclosure: boolean;
    antiSteering: boolean;
  };
  deliveryEdits: Pick<LoanDeliveryEditResult, "deliverable"> & {
    fatalCount: number;
    warningCount: number;
    notEvaluatedCount: number;
  };
  now?: Date;
}

export function deriveSubmissionStages(inputs: StageDerivationInputs): Omit<BrokerSubmissionReadiness, "applicationId"> {
  const now = inputs.now ?? new Date();
  const stages: SubmissionStage[] = [];

  // --- Stage 1: intake & disclosures -------------------------------------
  const intakeBlockers: string[] = [];
  const intakeWarnings: string[] = [];
  if (inputs.urla.gseGatingFailed) {
    intakeBlockers.push("Required URLA fields are missing in gating sections 1a/4/5");
  }
  if (inputs.urla.tridStatus.leRequired && !inputs.urla.tridStatus.leIssued) {
    const due = inputs.urla.tridStatus.leDueDate;
    if (due && now > due) {
      intakeBlockers.push("TRID: the Loan Estimate is past its 3-business-day delivery deadline");
    } else {
      intakeWarnings.push("TRID clock is running — the Loan Estimate has not been issued yet");
    }
  }
  if (!inputs.consents.eDisclosure) {
    intakeWarnings.push("No e-disclosure (ESIGN) consent on file — disclosures must go out on paper until captured");
  }
  stages.push({
    key: "intake",
    label: "File intake & disclosures",
    status: intakeBlockers.length > 0 ? "blocked" : intakeWarnings.length > 0 ? "attention" : "ready",
    blockers: intakeBlockers,
    warnings: intakeWarnings,
  });

  // --- Stage 2: AUS --------------------------------------------------------
  const ausBlockers: string[] = [];
  const ausWarnings: string[] = [];
  if (inputs.urla.criticalErrors.length > 0) {
    ausBlockers.push(`${inputs.urla.criticalErrors.length} critical URLA/regulatory error(s) block AUS submission`);
  }
  if (!inputs.aus.casefileId) {
    ausWarnings.push("No DU casefile yet — run AUS before selecting a wholesale lender");
  } else if (!inputs.aus.recommendation) {
    ausWarnings.push("DU casefile created but no recommendation captured yet");
  }
  // Broker doctrine targets dual AUS; the LPA leg is not built yet.
  if (inputs.aus.recommendation) {
    ausWarnings.push("LPA leg not available — recommendation is DU-only");
  }
  stages.push({
    key: "aus",
    label: "Automated underwriting (DU)",
    status: ausBlockers.length > 0
      ? "blocked"
      : inputs.aus.recommendation
        ? (ausWarnings.length > 1 ? "attention" : "ready")
        : "attention",
    blockers: ausBlockers,
    warnings: ausWarnings,
  });

  // --- Stage 3: wholesale lender package ----------------------------------
  const pkgBlockers: string[] = [];
  const pkgWarnings: string[] = [];
  if (!inputs.uldd.valid) {
    inputs.uldd.errors.forEach(e => pkgBlockers.push(`MISMO file: ${e}`));
  }
  inputs.uldd.warnings.forEach(w => pkgWarnings.push(`MISMO file: ${w}`));
  if (inputs.urla.missingDocuments.length > 0) {
    pkgBlockers.push(`${inputs.urla.missingDocuments.length} required document(s) outstanding: ${inputs.urla.missingDocuments.join(", ")}`);
  }
  if (!inputs.urla.pointsAndFeesCompliant) {
    pkgBlockers.push("QM pre-flight: points and fees exceed the Reg Z cap for this loan amount");
  } else if (inputs.urla.qmStatus === "Unknown") {
    pkgWarnings.push("QM pre-flight not evaluable yet (points and fees or loan amount missing)");
  }
  if (!inputs.consents.antiSteering) {
    pkgBlockers.push("Anti-steering loan-options disclosure (Reg Z §1026.36(e)(3)) has not been acknowledged");
  }
  stages.push({
    key: "lenderPackage",
    label: "Wholesale lender package",
    status: pkgBlockers.length > 0 ? "blocked" : pkgWarnings.length > 0 ? "attention" : "ready",
    blockers: pkgBlockers,
    warnings: pkgWarnings,
  });

  // --- Stage 4: delivery pre-flight (informational) ------------------------
  const preflightWarnings: string[] = [];
  if (inputs.deliveryEdits.fatalCount > 0) {
    preflightWarnings.push(`${inputs.deliveryEdits.fatalCount} Loan Delivery/UCD edit(s) would fire at the lender's delivery — expect conditions`);
  }
  if (inputs.deliveryEdits.notEvaluatedCount > 0) {
    preflightWarnings.push(`${inputs.deliveryEdits.notEvaluatedCount} delivery check(s) awaiting closing-stage data (lender-side)`);
  }
  stages.push({
    key: "deliveryPreflight",
    label: "Delivery pre-flight (lender's-eye view)",
    // Never blocks a broker submission — closing data is the lender's.
    status: inputs.deliveryEdits.fatalCount > 0 ? "attention" : "ready",
    blockers: [],
    warnings: preflightWarnings,
  });

  const gatingStages = stages.slice(0, 3);
  const readyToSubmitToLender = gatingStages.every(s => s.status === "ready" || s.status === "attention")
    && gatingStages.every(s => s.blockers.length === 0);

  const currentStage = (stages.find(s => s.status === "blocked") ?? stages.find(s => s.status === "attention") ?? stages[2]).key;

  const nextActions = stages.flatMap(s =>
    s.blockers.map(b => `[${s.label}] ${b}`),
  );
  if (nextActions.length === 0 && readyToSubmitToLender) {
    nextActions.push("File is packaging-complete — select a wholesale lender and submit");
  }

  return { readyToSubmitToLender, currentStage, stages, nextActions };
}

export async function evaluateBrokerSubmissionReadiness(applicationId: string): Promise<BrokerSubmissionReadiness> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const { validateMISMOCompleteness } = await import("./mismoValidation");
  const urla = await validateMISMOCompleteness(applicationId);

  const mismoData = await storage.getMISMOLoanData(applicationId);
  const uldd = mismoData
    ? validateULDDCompliance(mismoData as MISMOLoanDTO)
    : { valid: false, errors: ["MISMO loan data could not be assembled"], warnings: [], phase5Ready: false };

  const [eDisclosure, antiSteering] = await Promise.all([
    hasBorrowerConsent("e_disclosure", applicationId),
    hasBorrowerConsent("anti_steering", applicationId),
  ]);

  const { evaluateDeliveryReadiness } = await import("./loanDeliveryReadiness");
  const delivery = await evaluateDeliveryReadiness(applicationId);

  const derived = deriveSubmissionStages({
    urla: {
      gseGatingFailed: urla.gseGatingFailed,
      criticalErrors: urla.criticalErrors,
      missingDocuments: urla.missingDocuments,
      qmStatus: urla.qmStatus,
      pointsAndFeesCompliant: urla.pointsAndFeesCompliant,
      tridStatus: {
        leRequired: urla.tridStatus.leRequired,
        leDueDate: urla.tridStatus.leDueDate,
        leIssued: urla.tridStatus.leIssued,
      },
    },
    uldd,
    aus: {
      casefileId: application.ausCasefileId ?? null,
      recommendation: application.ausRecommendation ?? null,
    },
    consents: { eDisclosure, antiSteering },
    deliveryEdits: {
      deliverable: delivery.edits.deliverable,
      fatalCount: delivery.edits.fatal.length,
      warningCount: delivery.edits.warnings.length,
      notEvaluatedCount: delivery.edits.notEvaluated.length,
    },
  });

  return { applicationId, ...derived };
}
