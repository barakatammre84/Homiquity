// The lazily-built Anthropic client singleton + configuration gate + model constants. LEAF module: no coaching sibling imports.
// Split from the old server/services/coachingService.ts — which re-exports it.
import Anthropic from "@anthropic-ai/sdk";

// The coach data types + Zod schemas live in coachTools.ts (they define the
// tool surface); re-export them so this module's public API is unchanged for
// the route layer and any future consumers.
export {
  coachProfileSchema,
  coachIntakeSchema,
  coachActionPlanSchema,
  coachDocumentChecklistSchema,
  borrowerPackageSchema,
  COACH_TOOLS,
  type CoachingProfile,
  type ActionPlanItem,
  type DocumentRequirement,
  type CoachIntakeData,
  type BorrowerPackage,
  type CoachStreamEvent,
  type CoachEmit,
  type CoachToolTurnState,
} from "./coachTools";

// Lazily constructed: the SDK client is built on first use, and this module is
// imported by the route registry — an eager client here would make boot depend
// on AI credentials. (The old OpenAI client THREW at construction with no key
// and took down every API route on Vercel; the Anthropic SDK defers key
// validation to the first request, but we keep the lazy pattern and the
// isCoachConfigured() gate so the coach degrades to labeled offline guidance
// instead of erroring per-request.)
let anthropicClient: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 15_000, // ms — per model call; the turn has its own 25s wall-clock budget
      maxRetries: 1,
    });
  }
  return anthropicClient;
}

export function isCoachConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const COACH_MODEL = "claude-sonnet-5";
/**
 * Versioned prompt marker (AI_GOVERNANCE_POLICY §5.5). Stored on every
 * ai_interactions row instead of the full prompt text — the exact prompt is
 * reconstructable from git at this version. Bump on ANY prompt/tool change.
 */
export const COACH_PROMPT_VERSION = "coach-2.2.0";

export const MAX_MODEL_CALLS_PER_TURN = 2;
// Product turn budget, not a platform ceiling (the persistent host has none):
// bounds a runaway multi-tool turn so a wedged upstream stream cannot pin a
// coach turn open indefinitely, while leaving room for both model calls plus
// tool round-trips to finish instead of truncating mid-answer.
export const TURN_BUDGET_MS = 90_000;
export const MAX_COMPLETION_TOKENS = 2_048;
export const HISTORY_WINDOW_MESSAGES = 24; // ≈12 exchanges resent per turn
