import { db } from "../db";
import { aiInteractions, type InsertAiInteraction } from "@shared/schema";

/**
 * AI-governance logging — the first (and so far only) writer to the
 * `ai_interactions` table (shared/schema/ai.ts). One row per model invocation,
 * for CFPB/state-exam traceability: "what guidance did the system give this
 * borrower on that date?" (AI_GOVERNANCE_POLICY P3).
 *
 * Deliberately fire-and-forget: governance logging must never take down the
 * user-facing request (same posture as server/auditLog.ts). Failures are
 * logged to stderr and swallowed.
 *
 * PII posture: `prompt`/`response` hold the exchange verbatim (the exam needs
 * it); `systemPrompt` holds only the version marker (e.g. COACH_PROMPT_VERSION)
 * — the full prompt text is reconstructable from git at that version, so we
 * don't persist ~7K tokens per call.
 */
export async function logAiInteraction(entry: InsertAiInteraction): Promise<void> {
  try {
    await db.insert(aiInteractions).values(entry);
  } catch (err) {
    console.error("[AI-Log] Failed to record ai_interaction:", err);
  }
}
