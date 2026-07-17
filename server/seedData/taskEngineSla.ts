import type { InsertSlaClassConfig, InsertTaskTypeSlaMapping } from "@shared/schema";

/**
 * Task-engine SLA reference data. Both tables shipped EMPTY for the engine's
 * whole life, so `computeSlaDueAt` always returned null (no task ever had a
 * deadline, so nothing ever escalated and every SLA chip rendered green) and
 * `taskTypeSlaMapping.defaultOwnerRole` / `visibleToBorrower` never fired.
 *
 * Seeded boot-time by server/seed.ts, insert-only with onConflictDoNothing on
 * the natural keys (slaClass / taskTypeCode) — the DB rows are the live config
 * and an operator's edits must survive redeploys; this file only fills gaps.
 *
 * Timings come from the SLA_CLASSES doc in shared/schema/underwritingTasks.ts
 * (S0 0-1h/esc 15m · S1 4h/2h · S2 12h/8h · S3 48h/36h · S4 72h/60h · S5 none);
 * hard breach = 2× target. Only targetResolutionMinutes drives behavior today
 * (it sets tasks.slaDueAt, which powers the red/amber/green chips, queue sort,
 * and the escalation sweep); escalationStart/hardBreach are config-only.
 */
export const SLA_CLASS_CONFIG_SEED: InsertSlaClassConfig[] = [
  { slaClass: "S0", name: "Immediate", description: "Drop everything — resolve within the hour.", targetResolutionMinutes: 60, escalationStartMinutes: 15, hardBreachMinutes: 120, blocksLoanProgress: true, displayOrder: 0, colorCode: "red" },
  { slaClass: "S1", name: "Critical", description: "Same-shift resolution (4 hours).", targetResolutionMinutes: 240, escalationStartMinutes: 120, hardBreachMinutes: 480, blocksLoanProgress: true, displayOrder: 1, colorCode: "orange" },
  { slaClass: "S2", name: "High", description: "Same-day resolution (12 hours).", targetResolutionMinutes: 720, escalationStartMinutes: 480, hardBreachMinutes: 1440, blocksLoanProgress: true, displayOrder: 2, colorCode: "amber" },
  { slaClass: "S3", name: "Standard", description: "Two business days (48 hours).", targetResolutionMinutes: 2880, escalationStartMinutes: 2160, hardBreachMinutes: 5760, blocksLoanProgress: true, displayOrder: 3, colorCode: "blue" },
  { slaClass: "S4", name: "Low", description: "Three days (72 hours); does not block the file.", targetResolutionMinutes: 4320, escalationStartMinutes: 3600, hardBreachMinutes: 8640, blocksLoanProgress: false, displayOrder: 4, colorCode: "gray" },
  { slaClass: "S5", name: "Informational", description: "No deadline; awareness only.", targetResolutionMinutes: null, escalationStartMinutes: null, hardBreachMinutes: null, blocksLoanProgress: false, displayOrder: 5, colorCode: "slate" },
];

/**
 * One mapping per task code the system actually emits (the taskEventEmitter
 * switch blocks, plus createTaskFromEvent's DOCUMENT_REQUEST fallback). The
 * declared-but-never-emitted legacy codes in TASK_TYPE_CODES stay unmapped on
 * purpose — an unmapped code falls back to S3/no-deadline exactly as before,
 * and a mapping should be added the day a writer starts emitting the code.
 *
 * defaultOwnerRole only applies when the creator didn't set ownerRole
 * (explicit wins — see taskEngine.createTask). Every emitted code is staff
 * work by its own title ("Review uploaded…", "Begin underwriting review") —
 * none are BORROWER: borrower action items are the pipeline/staff document
 * tasks governed by deriveDocumentTaskOwnerRole, not event tasks.
 *
 * visibleToBorrower marks staff tasks the borrower may SEE for transparency
 * (never act on): getBorrowerTasks returns them IN ADDITION to BORROWER-owned
 * tasks, and BorrowerRequests keeps filtering to ownerRole === "BORROWER" for
 * actionables, so these stay dormant until a transparency surface consumes
 * them. Every visible mapping must carry borrowerDisplayText (test-enforced).
 */
export const TASK_TYPE_SLA_MAPPING_SEED: InsertTaskTypeSlaMapping[] = [
  // Document intelligence (emitDocumentEvent)
  { taskTypeCode: "DOC_REVIEW", taskTypeName: "Review uploaded document", category: "document", slaClass: "S2", defaultOwnerRole: "PROCESSOR", visibleToBorrower: true, borrowerDisplayText: "We're reviewing a document you uploaded." },
  { taskTypeCode: "OCR_FAILED", taskTypeName: "Document extraction failed", category: "ocr", slaClass: "S2", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "OCR_QUALITY", taskTypeName: "Document quality issue", category: "ocr", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "DOC_EXPIRED", taskTypeName: "Document expired", category: "document", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: true, borrowerDisplayText: "One of your documents has expired — we'll request a fresh copy." },
  { taskTypeCode: "DOC_MISSING", taskTypeName: "Missing required document", category: "document", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: true, borrowerDisplayText: "We're waiting on a required document." },
  { taskTypeCode: "DOCUMENT_REQUEST", taskTypeName: "Document request", category: "document", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  // Workflow stage transitions (emitWorkflowEvent)
  { taskTypeCode: "INTAKE_REVIEW", taskTypeName: "Review new application", category: "intake", slaClass: "S2", defaultOwnerRole: "LO", visibleToBorrower: false },
  { taskTypeCode: "PA_GENERATE", taskTypeName: "Begin document collection after pre-approval", category: "pre_approval", slaClass: "S2", defaultOwnerRole: "LO", visibleToBorrower: false },
  // ECOA §1002.9(a)(1) 30-day statutory deadline rides on tasks.dueDate (the
  // emitter stamps it); this SLA is the internal work-start target, not the
  // legal deadline.
  { taskTypeCode: "CMP_ADVERSE_ACTION", taskTypeName: "Generate adverse action notice", category: "compliance", slaClass: "S2", defaultOwnerRole: "ADMIN", visibleToBorrower: false },
  { taskTypeCode: "DOC_COLLECT_START", taskTypeName: "Document collection kickoff", category: "document", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "PROC_START", taskTypeName: "Begin loan processing", category: "processing", slaClass: "S2", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "UW_START", taskTypeName: "Begin underwriting review", category: "underwriting", slaClass: "S2", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "ELIG_COND_CLEAR", taskTypeName: "Clear pending conditions", category: "eligibility", slaClass: "S3", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "CMP_CLOSING_DISC", taskTypeName: "Prepare closing package", category: "closing", slaClass: "S2", defaultOwnerRole: "CLOSER", visibleToBorrower: false },
  // Change-of-circumstance monitors (emitCreditEvent / emitIncomeEvent / emitAssetEvent)
  { taskTypeCode: "CRD_SCORE_CHANGE", taskTypeName: "Credit score change review", category: "credit", slaClass: "S2", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "CRD_NEW_TRADELINE", taskTypeName: "New tradeline investigation", category: "credit", slaClass: "S2", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "CRD_EXPIRED", taskTypeName: "Credit report re-pull", category: "credit", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "INC_CHANGE", taskTypeName: "Income change review", category: "income", slaClass: "S2", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "INC_VERIFY_EMP", taskTypeName: "Employment verification", category: "income", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "INC_EXPIRED", taskTypeName: "Income documentation refresh", category: "income", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
  { taskTypeCode: "AST_DECREASE", taskTypeName: "Asset decrease review", category: "assets", slaClass: "S2", defaultOwnerRole: "UW", visibleToBorrower: false },
  { taskTypeCode: "AST_VERIFY", taskTypeName: "Asset verification", category: "assets", slaClass: "S3", defaultOwnerRole: "PROCESSOR", visibleToBorrower: false },
];
