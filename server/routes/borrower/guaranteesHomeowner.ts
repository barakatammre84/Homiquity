// Borrower routes: Closing guarantees + homeowner value (refi alerts, equity).
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { isAdmin } from "@shared/roles";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { isStaffRole } from "@shared/schema";
import { routeParam } from "../../http/routeParams";
import { parseBodyOr400 } from "../validate";
import { homeownerProfileWriteSchema } from "./homeownerProfilePayload";
import {
  evaluateRefiOpportunity,
  getMarketRate30YrFixed,
  recordEquitySnapshot,
  resolveHomeownerPosition,
} from "../../services/lifecycleEngine";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerGuaranteeHomeownerRoutes(
  app: Express,
  storage: IStorage,
) {
  // Closing Guarantee Routes
  // =============================================

  // List all guarantees: admin only — this returns every record system-wide so it
  // cannot be meaningfully scoped without enumerating the caller's assigned files.
  app.get("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isAdmin(req.user)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const guarantees = await storage.getAllClosingGuarantees();
      res.json(guarantees);
    } catch (error) {
      console.error("Get all closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  // Per-application guarantees: verify the caller is an assigned deal-team member
  // (or admin) for that specific loan file before returning records.
  app.get("/api/closing-guarantees/:applicationId", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        routeParam(req, "applicationId"),
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      const guarantees = await storage.getClosingGuarantees(routeParam(req, "applicationId"));
      res.json(guarantees);
    } catch (error) {
      console.error("Get closing guarantees error:", error);
      res.status(500).json({ error: "Failed to get closing guarantees" });
    }
  });

  // Create guarantee: verify the caller has access to the target application.
  app.post("/api/closing-guarantees", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const { applicationId } = req.body;
      if (!applicationId) {
        return res.status(400).json({ error: "applicationId is required" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        applicationId,
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      const guarantee = await storage.createClosingGuarantee(req.body);
      res.status(201).json(guarantee);
    } catch (error) {
      console.error("Create closing guarantee error:", error);
      res.status(500).json({ error: "Failed to create closing guarantee" });
    }
  });

  // Update guarantee: look up the existing record to find its applicationId, then
  // verify the caller has deal-team access before allowing the mutation.
  app.put("/api/closing-guarantees/:id", isAuthenticated, async (req, res) => {
    try {
      if (!isStaffRole(req.user!.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const existing = await storage.getClosingGuarantee(routeParam(req, "id"));
      if (!existing) {
        return res.status(404).json({ error: "Closing guarantee not found" });
      }
      const application = await storage.getLoanApplicationWithAccess(
        existing.applicationId,
        req.user!.id,
        req.user!.role
      );
      if (!application) {
        return res.status(403).json({ error: "Access denied to this loan file" });
      }
      // Strip immutable ownership and identity fields from the update payload so
      // callers cannot reassign the record to a different application or forge
      // timestamps by including them in req.body.
      const { id: _id, applicationId: _appId, createdAt: _ca, updatedAt: _ua, ...safeUpdate } = req.body;
      const guarantee = await storage.updateClosingGuarantee(routeParam(req, "id"), safeUpdate);
      if (!guarantee) {
        return res.status(404).json({ error: "Closing guarantee not found" });
      }
      res.json(guarantee);
    } catch (error) {
      console.error("Update closing guarantee error:", error);
      res.status(500).json({ error: "Failed to update closing guarantee" });
    }
  });

  // =============================================
  // Homeowner Value Routes
  // =============================================
  app.get("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      res.json(profile || null);
    } catch (error) {
      console.error("Get homeowner profile error:", error);
      res.status(500).json({ error: "Failed to get homeowner profile" });
    }
  });

  app.post("/api/homeowner/profile", isAuthenticated, async (req, res) => {
    try {
      // The setup form posts every control it renders, so the ones the owner left
      // alone arrive as "". Validating here is what keeps a blank date out of the
      // driver — it used to reach Drizzle and 500 for every first-time owner.
      const data = parseBodyOr400(homeownerProfileWriteSchema, req.body, res);
      if (data === undefined) return;
      const profile = await storage.createHomeownerProfile({
        ...data,
        userId: req.user!.id,
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Create homeowner profile error:", error);
      res.status(500).json({ error: "Failed to create homeowner profile" });
    }
  });

  app.put("/api/homeowner/profile/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== routeParam(req, "id")) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Same validation as the create path: the annual-review action sends
      // `nextReviewDate` as a date string, which Drizzle cannot map on its own.
      const data = parseBodyOr400(homeownerProfileWriteSchema.partial(), req.body, res);
      if (data === undefined) return;
      const updated = await storage.updateHomeownerProfile(routeParam(req, "id"), data);
      if (!updated) {
        return res.status(404).json({ error: "Homeowner profile not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update homeowner profile error:", error);
      res.status(500).json({ error: "Failed to update homeowner profile" });
    }
  });

  app.get("/api/homeowner/refi-alerts/:profileId", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== routeParam(req, "profileId")) {
        return res.status(404).json({ error: "Profile not found" });
      }
      const alerts = await storage.getRefiAlerts(routeParam(req, "profileId"));
      res.json(alerts);
    } catch (error) {
      console.error("Get refi alerts error:", error);
      res.status(500).json({ error: "Failed to get refi alerts" });
    }
  });

  // "Check rates" runs the same refi evaluation the daily sweep runs — including
  // the EPO clawback suppression and the open-alert de-dup, which a client-built
  // alert would have bypassed. The rates and the savings figures are derived
  // server-side; the caller supplies nothing, so no borrower-facing savings claim
  // can be composed from the wire.
  app.post("/api/homeowner/refi-alerts", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Access denied" });
      }
      const position = await resolveHomeownerPosition(profile);
      if (!position) {
        return res.status(409).json({
          error:
            "We need your property value and your loan balance before we can compare your rate to the market. Add them in Quick Actions and try again.",
          reason: "incomplete-profile",
        });
      }
      const marketRate = await getMarketRate30YrFixed();
      const outcome = await evaluateRefiOpportunity(profile, position, marketRate);
      res.status(outcome.created ? 201 : 200).json(outcome);
    } catch (error) {
      console.error("Create refi alert error:", error);
      res.status(500).json({ error: "Failed to create refi alert" });
    }
  });

  app.put("/api/homeowner/refi-alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Fetch the alert BEFORE writing to verify ownership
      const existing = await storage.getRefiAlertById(routeParam(req, "id"));
      if (!existing || existing.homeownerProfileId !== profile.id) {
        return res.status(404).json({ error: "Refi alert not found" });
      }
      // Strip homeownerProfileId from body to prevent ownership-link reassignment
      const { homeownerProfileId: _stripR, ...alertBody } = req.body;
      const updated = await storage.updateRefiAlert(routeParam(req, "id"), alertBody, profile.id);
      if (!updated) {
        return res.status(404).json({ error: "Refi alert not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update refi alert error:", error);
      res.status(500).json({ error: "Failed to update refi alert" });
    }
  });

  app.get("/api/homeowner/equity/:profileId", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== routeParam(req, "profileId")) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const snapshots = await storage.getEquitySnapshots(profile.id);
      res.json(snapshots);
    } catch (error) {
      console.error("Get equity snapshots error:", error);
      res.status(500).json({ error: "Failed to get equity snapshots" });
    }
  });

  // "Record snapshot" runs the same derivation the daily lifecycle sweep runs,
  // scoped to the caller's own profile. It deliberately takes no body: an equity
  // snapshot is a measurement of the file, not something an owner types in, and
  // the previous handler inserted whatever it was given — which for the Hub's own
  // button was nothing at all, so the NOT NULL snapshot_date blew up in the
  // driver and every press returned 500.
  app.post("/api/homeowner/equity", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const position = await resolveHomeownerPosition(profile);
      if (!position) {
        return res.status(409).json({
          error:
            "We need your property value and your loan balance before we can measure your equity. Add them in Quick Actions and try again.",
          reason: "incomplete-profile",
        });
      }
      const outcome = await recordEquitySnapshot(profile, position);
      // 200 rather than 201 when nothing was written — the Hub reports what
      // actually happened instead of an unconditional "Snapshot recorded".
      res.status(outcome.created ? 201 : 200).json(outcome);
    } catch (error) {
      console.error("Create equity snapshot error:", error);
      res.status(500).json({ error: "Failed to create equity snapshot" });
    }
  });

  // =============================================
}
