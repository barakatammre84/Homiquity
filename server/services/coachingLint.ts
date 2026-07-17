// The Reg N lint rail: streaming hard-block scan + post-hoc filter + the fixed safe message.
// Split from the old server/services/coachingService.ts — which re-exports it.
import { lintOutboundText } from "@shared/compliance/loCommsLint";

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

/**
 * Fixed replacement shown (and persisted) when the model emits a Reg N
 * hard-block phrase (e.g. an approval guarantee). Wording is negation-clean
 * for the lexicon and uses no approval-likelihood language itself.
 */
export const COACH_LINT_SAFE_MESSAGE =
  "I need to correct something: no approval is ever guaranteed before underwriting review. " +
  "What I can help with is making sure every required input in your file is complete and verified — " +
  "that preparation is the part we control together. Final decisions always depend on verification " +
  "of your documents and a full underwriting review. Want to look at the next required input?";

export interface CoachLintHit {
  categories: string[];
  citations: string[];
}

/**
 * Incremental streaming guard: check only the sentence-complete prefix of the
 * accumulated reply for AFFIRMATIVE hard-block phrases. Sentence-bounding
 * matters — a trailing negation inside the same sentence ("…is not
 * guaranteed") must be seen before judging the clause, so we never judge a
 * half-written sentence. Exported for unit tests.
 */
export function findStreamingHardBlock(buffer: string): CoachLintHit | null {
  const lastTerminator = Math.max(
    buffer.lastIndexOf("."),
    buffer.lastIndexOf("!"),
    buffer.lastIndexOf("?"),
    buffer.lastIndexOf("\n"),
  );
  if (lastTerminator < 0) return null;
  const complete = buffer.slice(0, lastTerminator + 1);
  const result = lintOutboundText(complete);
  if (result.hardBlockMatches.length === 0) return null;
  return {
    categories: [...new Set(result.hardBlockMatches.map((m) => m.category))],
    citations: [...new Set(result.hardBlockMatches.map((m) => m.citation))],
  };
}

/**
 * Full-text post-filter, run on the completed reply before persistence.
 *  - Reg N hard-blocks (guaranteed/assured approval): REPLACE the message.
 *  - Everything else the lexicon flags (Reg Z trigger terms like "20% down",
 *    Tier-2 superlatives): LOG-ONLY. Full Tier-1 blocking would gut ordinary
 *    coaching language; the prompt bans rate/APR/points figures at the source.
 *    ⚠ Founder/compliance decision — escalating any category to replacement
 *    is a one-line change here.
 * Exported for unit tests.
 */
export function applyCoachLintFilter(text: string): {
  text: string;
  replaced: boolean;
  hit: CoachLintHit | null;
  flaggedCategories: string[];
} {
  const result = lintOutboundText(text);
  const flaggedCategories = [
    ...new Set([...result.triggerMatches, ...result.promiseMatches].map((m) => m.category)),
  ];
  if (result.hardBlockMatches.length > 0) {
    return {
      text: COACH_LINT_SAFE_MESSAGE,
      replaced: true,
      hit: {
        categories: [...new Set(result.hardBlockMatches.map((m) => m.category))],
        citations: [...new Set(result.hardBlockMatches.map((m) => m.citation))],
      },
      flaggedCategories,
    };
  }
  return { text, replaced: false, hit: null, flaggedCategories };
}

