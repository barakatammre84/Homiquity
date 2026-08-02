// Borrower routes: Closing guarantees + homeowner value (refi alerts, equity).
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { isStaffRole } from "@shared/schema";
import { routeParam } from "../../http/routeParams";

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
      if (req.user!.role !== "admin") {
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
      const profile = await storage.createHomeownerProfile({
        ...req.body,
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
      const updated = await storage.updateHomeownerProfile(routeParam(req, "id"), req.body);
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

  app.post("/api/homeowner/refi-alerts", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile || profile.id !== req.body.homeownerProfileId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const alert = await storage.createRefiAlert(req.body);
      res.status(201).json(alert);
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

  app.post("/api/homeowner/equity", isAuthenticated, async (req, res) => {
    try {
      const profile = await storage.getHomeownerProfile(req.user!.id);
      if (!profile) {
        return res.status(403).json({ error: "Forbidden" });
      }
      // Override any caller-supplied homeownerProfileId with the authenticated user's own profile
      const snapshot = await storage.createEquitySnapshot({ ...req.body, homeownerProfileId: profile.id });
      res.status(201).json(snapshot);
    } catch (error) {
      console.error("Create equity snapshot error:", error);
      res.status(500).json({ error: "Failed to create equity snapshot" });
    }
  });

  // =============================================
}
