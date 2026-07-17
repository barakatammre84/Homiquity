// Re-export shim: the old 2,923-line lending schema now lives in six domain
// files (split 2026-07-17). Kept so the barrel (shared/schema.ts) and the 11
// schema files that import "./lending" directly stay untouched. Add new
// lending tables to the matching lending*.ts file, not here.
export * from "./lendingCore";
export * from "./lendingUrla";
export * from "./lendingRatesOps";
export * from "./lendingLetters";
export * from "./lendingWholesale";
export * from "./lendingComms";
