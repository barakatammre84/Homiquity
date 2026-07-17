// Re-export shim: the old 2,198-line credit service now lives in eight
// credit*.ts domain files (split 2026-07-17). Kept so the 7 server importers
// and 4 test files keep importing "services/creditService" unchanged. Add new
// credit logic to the matching credit*.ts file, not here.
//
// creditAuditChain is deliberately NOT re-exported in full: logCreditAction is
// an internal write seam — external callers audit via the exported functions.
export * from "./creditCatalogs";
export * from "./creditConsents";
export * from "./creditPulls";
export * from "./creditAdverseActions";
export * from "./creditAudit";
export * from "./creditConsentDrafts";
export * from "./creditRetention";
