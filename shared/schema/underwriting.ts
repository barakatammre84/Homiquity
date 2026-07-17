// Re-export shim: the old 2,060-line underwriting schema now lives in five
// domain files (split 2026-07-17). Kept so the barrel and direct "./underwriting"
// importers stay untouched. Add new underwriting tables to the matching file.
export * from "./underwritingTasks";
export * from "./underwritingFinancials";
export * from "./underwritingCore";
export * from "./underwritingConditions";
export * from "./underwritingPolicy";
