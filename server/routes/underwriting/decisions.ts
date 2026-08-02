// Underwriting routes: Instant decision, decision history, staff AI risk brief.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { requireRole } from "../../auth";
import * as creditService from "../../services/creditService";
import { routeParams } from "../../http/routeParams";

export function registerDecisionRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get(
    "/api/loan-applications/:id/instant-decision",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const { runInstantDecision } = await import("../../services/decisionEngine");
        const decision = await runInstantDecision(id);
        res.json(decision);
      } catch (error) {
        console.error("Instant decision error:", error);
        res.status(500).json({ error: "Failed to compute instant decision" });
      }
    },
  );

  // Decision history — the context-graph trail of how the decision evolved as
  // facts arrived. Staff-only, read-only.
  app.get(
    "/api/loan-applications/:id/decision-history",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const { getDecisionHistory } = await import("../../services/decisionEngine");
        res.json(await getDecisionHistory(id));
      } catch (error) {
        console.error("Decision history error:", error);
        res.status(500).json({ error: "Failed to load decision history" });
      }
    },
  );

  // AI risk brief (advisory, internal_only — roadmap A4). Narrates the
  // deterministic outputs; never recomputes them, never feeds a decision or an
  // adverse-action notice (CI-enforced in tests/complianceInvariants.test.ts).
  // POST, not GET: each call spends model tokens and writes an ai_interactions
  // governance row, so it must never auto-fire from a mounted useQuery.
  app.post(
    "/api/loan-applications/:id/risk-brief",
    requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"),
    async (req, res) => {
      try {
        const { id } = routeParams(req);
        const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
        if (!application) {
          return res.status(404).json({ error: "Application not found" });
        }
        const { generateRiskBrief } = await import("../../services/riskBrief");
        res.json(await generateRiskBrief(id, { userId: req.user!.id, userRole: req.user!.role }));
      } catch (error) {
        console.error("Risk brief error:", error);
        res.status(500).json({ error: "Failed to generate risk brief" });
      }
    },
  );

  // ============================================================================
  // LOAN PIPELINE API ENDPOINTS
  // ============================================================================

}
