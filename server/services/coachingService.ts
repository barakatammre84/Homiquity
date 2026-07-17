// Re-export shim: the coach now lives in five coaching*.ts files (split
// 2026-07-17). Kept so the route registry, coachTools, riskBrief, and tests
// keep importing "services/coachingService" unchanged.
//
// getAnthropic and STATIC_COACH_PROMPT are deliberately NOT re-exported —
// they are internal seams (client singleton / cached prompt prefix).
export { isCoachConfigured, COACH_MODEL, COACH_PROMPT_VERSION } from "./coachingClient";
export * from "./coachingContext";
export * from "./coachingLint";
export * from "./coachingTurn";
