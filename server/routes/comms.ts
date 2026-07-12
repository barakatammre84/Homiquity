import type { Express } from "express";
import { requireRole } from "../auth";
import { SCENARIO_CATALOG } from "../services/scenarioCatalog";
import { REG_N_PROMISE_LEXICON } from "@shared/compliance/loCommsLint";

/**
 * LO comms script library (LO Advisor Program prompt LO-5).
 *
 * Projects two already-written, already-cited sources into insertable,
 * pre-approved snippets so an LO reaches for vetted language instead of
 * free-texting risky figures:
 *   - the scenario catalog's per-scenario loanOfficerActions (cited to the
 *     underwriting guideline that scenario implements), and
 *   - the Reg N §1014.3 compliant rewrites from the comms lint lexicon.
 *
 * Read-only, internal-staff only. Pure projection (buildCommsSnippets) so it is
 * unit-testable without a server.
 */

export interface CommsSnippetGroup {
  scenarioId: string;
  title: string;
  citations: string[];
  snippets: string[];
}

export interface CompliantPhrasing {
  category: string;
  citation: string;
  text: string;
}

export interface CommsSnippetLibrary {
  talkingPoints: CommsSnippetGroup[];
  compliantPhrasings: CompliantPhrasing[];
}

/** Pure projection of the catalog + lexicon into the snippet library. */
export function buildCommsSnippets(): CommsSnippetLibrary {
  const talkingPoints: CommsSnippetGroup[] = SCENARIO_CATALOG.filter(
    (s) => s.workflow.loanOfficerActions.length > 0,
  ).map((s) => ({
    scenarioId: s.scenarioId,
    title: s.title,
    citations: s.regulations,
    snippets: s.workflow.loanOfficerActions,
  }));

  const compliantPhrasings: CompliantPhrasing[] = REG_N_PROMISE_LEXICON.filter(
    (r) => r.suggestedRewrite,
  ).map((r) => ({
    category: r.category,
    citation: r.citation,
    text: r.suggestedRewrite!,
  }));

  return { talkingPoints, compliantPhrasings };
}

export function registerCommsRoutes(app: Express) {
  app.get(
    "/api/staff/comms/snippets",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    (_req, res) => {
      res.json(buildCommsSnippets());
    },
  );
}
