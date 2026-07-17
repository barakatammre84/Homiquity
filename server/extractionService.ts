// Re-export shim: extraction now lives in four extraction*.ts files (split
// 2026-07-17). Kept so the 9 server importers and 6 test files keep importing
// "extractionService" unchanged. Add new extraction logic to the matching file.
export * from "./extractionCore";
export * from "./extractionValidation";
export * from "./extractionDocuments";
export * from "./extractionTaxIntel";
