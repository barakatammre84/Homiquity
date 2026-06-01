import type { Express } from "express";
import type { IStorage } from "../storage";
import { requireRole } from "../auth";
import {
  insertPolicyProfileSchema,
  insertPolicyThresholdSchema,
  insertPolicyLenderOverlaySchema,
} from "@shared/schema";
import { logAudit } from "../auditLog";
import { z } from "zod";

const VALID_POLICY_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "RETIRED"];
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE", "DRAFT"],
  ACTIVE: ["RETIRED"],
  RETIRED: [],
};

export function registerPolicyOpsRoutes(
  app: Express,
  storage: IStorage,
) {
  // ============================================================================
  // POLICY PROFILES
  // ============================================================================

  app.get("/api/policy-profiles", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { authority, productType, status } = req.query;
      const filters: { authority?: string; productType?: string; status?: string } = {};
      if (authority && typeof authority === "string") filters.authority = authority;
      if (productType && typeof productType === "string") filters.productType = productType;
      if (status && typeof status === "string") filters.status = status;

      const profiles = await storage.getPolicyProfiles(filters);
      res.json(profiles);
    } catch (error) {
      console.error("Get policy profiles error:", error);
      res.status(500).json({ error: "Failed to get policy profiles" });
    }
  });

  app.get("/api/policy-profiles/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      const [thresholds, approvals, overlays] = await Promise.all([
        storage.getPolicyThresholds(req.params.id),
        storage.getPolicyApprovals(req.params.id),
        storage.getPolicyLenderOverlays(req.params.id),
      ]);

      res.json({ ...profile, thresholds, approvals, overlays });
    } catch (error) {
      console.error("Get policy profile error:", error);
      res.status(500).json({ error: "Failed to get policy profile" });
    }
  });

  app.post("/api/policy-profiles", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const parsed = insertPolicyProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid policy data", details: parsed.error.flatten() });
      }

      const profile = await storage.createPolicyProfile({
        ...parsed.data,
        status: "DRAFT",
        createdBy: req.user!.id,
      });

      await logAudit(req, "POLICY_CREATE", "policy_profile", profile.id, {
        profileId: profile.profileId,
        authority: profile.authority,
        productType: profile.productType,
      });

      res.status(201).json(profile);
    } catch (error) {
      console.error("Create policy profile error:", error);
      res.status(500).json({ error: "Failed to create policy profile" });
    }
  });

  app.patch("/api/policy-profiles/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status === "ACTIVE" || profile.status === "RETIRED") {
        return res.status(400).json({ error: `Cannot edit a policy in ${profile.status} status` });
      }

      const allowedFields = [
        "description", "bulletinReference", "sourceUrl",
        "effectiveDate", "expirationDate",
      ];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      const updated = await storage.updatePolicyProfile(req.params.id, updates);

      await logAudit(req, "POLICY_UPDATE", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        updatedFields: Object.keys(updates),
      });

      res.json(updated);
    } catch (error) {
      console.error("Update policy profile error:", error);
      res.status(500).json({ error: "Failed to update policy profile" });
    }
  });

  // ============================================================================
  // POLICY WORKFLOW TRANSITIONS
  // ============================================================================

  app.post("/api/policy-profiles/:id/submit", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (!VALID_TRANSITIONS[profile.status]?.includes("PENDING_APPROVAL")) {
        return res.status(400).json({ error: `Cannot submit from ${profile.status} status` });
      }

      const { justification } = req.body;
      if (!justification) {
        return res.status(400).json({ error: "Justification is required for submission" });
      }

      const updated = await storage.updatePolicyProfile(req.params.id, { status: "PENDING_APPROVAL" });

      await storage.createPolicyApproval({
        policyProfileId: req.params.id,
        fromStatus: profile.status,
        toStatus: "PENDING_APPROVAL",
        action: "SUBMIT",
        actionBy: req.user!.id,
        justification,
        bulletinReference: req.body.bulletinReference || null,
      });

      await logAudit(req, "POLICY_SUBMIT", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        fromStatus: profile.status,
        justification,
      });

      res.json(updated);
    } catch (error) {
      console.error("Submit policy error:", error);
      res.status(500).json({ error: "Failed to submit policy" });
    }
  });

  app.post("/api/policy-profiles/:id/approve", requireRole("admin"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Policy must be in PENDING_APPROVAL status to approve" });
      }

      if (profile.createdBy === req.user!.id) {
        return res.status(400).json({ error: "Cannot approve your own policy (four-eyes principle)" });
      }

      const { justification } = req.body;
      if (!justification) {
        return res.status(400).json({ error: "Justification is required for approval" });
      }

      const updated = await storage.updatePolicyProfile(req.params.id, {
        status: "APPROVED",
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      });

      await storage.createPolicyApproval({
        policyProfileId: req.params.id,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "APPROVED",
        action: "APPROVE",
        actionBy: req.user!.id,
        justification,
        bulletinReference: req.body.bulletinReference || null,
      });

      await logAudit(req, "POLICY_APPROVE", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        approvedBy: req.user!.id,
        justification,
      });

      res.json(updated);
    } catch (error) {
      console.error("Approve policy error:", error);
      res.status(500).json({ error: "Failed to approve policy" });
    }
  });

  app.post("/api/policy-profiles/:id/reject", requireRole("admin"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status !== "PENDING_APPROVAL") {
        return res.status(400).json({ error: "Policy must be in PENDING_APPROVAL status to reject" });
      }

      const { rejectionReason } = req.body;
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const updated = await storage.updatePolicyProfile(req.params.id, { status: "DRAFT" });

      await storage.createPolicyApproval({
        policyProfileId: req.params.id,
        fromStatus: "PENDING_APPROVAL",
        toStatus: "DRAFT",
        action: "REJECT",
        actionBy: req.user!.id,
        rejectionReason,
      });

      await logAudit(req, "POLICY_REJECT", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        rejectionReason,
      });

      res.json(updated);
    } catch (error) {
      console.error("Reject policy error:", error);
      res.status(500).json({ error: "Failed to reject policy" });
    }
  });

  app.post("/api/policy-profiles/:id/activate", requireRole("admin"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status !== "APPROVED") {
        return res.status(400).json({ error: "Policy must be in APPROVED status to activate" });
      }

      const updated = await storage.updatePolicyProfile(req.params.id, {
        status: "ACTIVE",
        activatedBy: req.user!.id,
        activatedAt: new Date(),
      });

      await storage.createPolicyApproval({
        policyProfileId: req.params.id,
        fromStatus: "APPROVED",
        toStatus: "ACTIVE",
        action: "ACTIVATE",
        actionBy: req.user!.id,
        justification: req.body.justification || "Policy activated",
      });

      await logAudit(req, "POLICY_ACTIVATE", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        activatedBy: req.user!.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Activate policy error:", error);
      res.status(500).json({ error: "Failed to activate policy" });
    }
  });

  app.post("/api/policy-profiles/:id/retire", requireRole("admin"), async (req, res) => {
    try {
      const profile = await storage.getPolicyProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status !== "ACTIVE") {
        return res.status(400).json({ error: "Policy must be in ACTIVE status to retire" });
      }

      const { justification } = req.body;
      if (!justification) {
        return res.status(400).json({ error: "Justification is required for retirement" });
      }

      const updated = await storage.updatePolicyProfile(req.params.id, {
        status: "RETIRED",
        retiredBy: req.user!.id,
        retiredAt: new Date(),
        expirationDate: new Date().toISOString().split("T")[0],
      });

      await storage.createPolicyApproval({
        policyProfileId: req.params.id,
        fromStatus: "ACTIVE",
        toStatus: "RETIRED",
        action: "RETIRE",
        actionBy: req.user!.id,
        justification,
      });

      await logAudit(req, "POLICY_RETIRE", "policy_profile", req.params.id, {
        profileId: profile.profileId,
        retiredBy: req.user!.id,
        justification,
      });

      res.json(updated);
    } catch (error) {
      console.error("Retire policy error:", error);
      res.status(500).json({ error: "Failed to retire policy" });
    }
  });

  // ============================================================================
  // POLICY THRESHOLDS
  // ============================================================================

  app.get("/api/policy-thresholds", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { policyProfileId } = req.query;
      if (!policyProfileId || typeof policyProfileId !== "string") {
        return res.status(400).json({ error: "policyProfileId query parameter is required" });
      }

      const thresholds = await storage.getPolicyThresholds(policyProfileId);
      res.json(thresholds);
    } catch (error) {
      console.error("Get policy thresholds error:", error);
      res.status(500).json({ error: "Failed to get policy thresholds" });
    }
  });

  app.post("/api/policy-thresholds", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const parsed = insertPolicyThresholdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid threshold data", details: parsed.error.flatten() });
      }

      const profile = await storage.getPolicyProfile(parsed.data.policyProfileId);
      if (!profile) {
        return res.status(404).json({ error: "Policy profile not found" });
      }

      if (profile.status === "ACTIVE" || profile.status === "RETIRED") {
        return res.status(400).json({ error: `Cannot add thresholds to a policy in ${profile.status} status` });
      }

      const threshold = await storage.createPolicyThreshold(parsed.data);

      await logAudit(req, "THRESHOLD_CREATE", "policy_threshold", threshold.id, {
        policyProfileId: parsed.data.policyProfileId,
        category: threshold.category,
        thresholdKey: threshold.thresholdKey,
      });

      res.status(201).json(threshold);
    } catch (error) {
      console.error("Create policy threshold error:", error);
      res.status(500).json({ error: "Failed to create policy threshold" });
    }
  });

  app.patch("/api/policy-thresholds/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const threshold = await storage.getPolicyThreshold(req.params.id);
      if (!threshold) {
        return res.status(404).json({ error: "Threshold not found" });
      }

      const profile = await storage.getPolicyProfile(threshold.policyProfileId);
      if (profile && (profile.status === "ACTIVE" || profile.status === "RETIRED")) {
        return res.status(400).json({ error: `Cannot edit thresholds on a policy in ${profile.status} status` });
      }

      const allowedFields = [
        "valueNumeric", "valuePercent", "valueBool", "valueEnum",
        "minBound", "maxBound", "materialityAction",
        "displayName", "description", "guidelineReference", "displayOrder",
      ];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      if (updates.valueNumeric !== undefined && threshold.minBound !== null && threshold.maxBound !== null) {
        const val = parseFloat(updates.valueNumeric);
        const min = parseFloat(threshold.minBound);
        const max = parseFloat(threshold.maxBound);
        if (val < min || val > max) {
          return res.status(400).json({ error: `Value must be between ${min} and ${max}` });
        }
      }

      const updated = await storage.updatePolicyThreshold(req.params.id, updates);

      await logAudit(req, "THRESHOLD_UPDATE", "policy_threshold", req.params.id, {
        policyProfileId: threshold.policyProfileId,
        thresholdKey: threshold.thresholdKey,
        updatedFields: Object.keys(updates),
        previousValues: Object.keys(updates).reduce((acc, key) => {
          acc[key] = (threshold as any)[key];
          return acc;
        }, {} as Record<string, any>),
      });

      res.json(updated);
    } catch (error) {
      console.error("Update policy threshold error:", error);
      res.status(500).json({ error: "Failed to update policy threshold" });
    }
  });

  app.delete("/api/policy-thresholds/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const threshold = await storage.getPolicyThreshold(req.params.id);
      if (!threshold) {
        return res.status(404).json({ error: "Threshold not found" });
      }

      const profile = await storage.getPolicyProfile(threshold.policyProfileId);
      if (profile && (profile.status === "ACTIVE" || profile.status === "RETIRED")) {
        return res.status(400).json({ error: `Cannot delete thresholds from a policy in ${profile.status} status` });
      }

      await storage.deletePolicyThreshold(req.params.id);

      await logAudit(req, "THRESHOLD_DELETE", "policy_threshold", req.params.id, {
        policyProfileId: threshold.policyProfileId,
        thresholdKey: threshold.thresholdKey,
        category: threshold.category,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete policy threshold error:", error);
      res.status(500).json({ error: "Failed to delete policy threshold" });
    }
  });

  // ============================================================================
  // POLICY LENDER OVERLAYS
  // ============================================================================

  app.get("/api/policy-overlays", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const { basePolicyProfileId } = req.query;
      if (!basePolicyProfileId || typeof basePolicyProfileId !== "string") {
        return res.status(400).json({ error: "basePolicyProfileId query parameter is required" });
      }

      const overlays = await storage.getPolicyLenderOverlays(basePolicyProfileId);
      res.json(overlays);
    } catch (error) {
      console.error("Get policy overlays error:", error);
      res.status(500).json({ error: "Failed to get policy overlays" });
    }
  });

  app.get("/api/policy-overlays/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const overlay = await storage.getPolicyLenderOverlay(req.params.id);
      if (!overlay) {
        return res.status(404).json({ error: "Overlay not found" });
      }
      res.json(overlay);
    } catch (error) {
      console.error("Get policy overlay error:", error);
      res.status(500).json({ error: "Failed to get policy overlay" });
    }
  });

  app.post("/api/policy-overlays", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const parsed = insertPolicyLenderOverlaySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid overlay data", details: parsed.error.flatten() });
      }

      const baseProfile = await storage.getPolicyProfile(parsed.data.basePolicyProfileId);
      if (!baseProfile) {
        return res.status(404).json({ error: "Base policy profile not found" });
      }

      const overlay = await storage.createPolicyLenderOverlay({
        ...parsed.data,
        status: "DRAFT",
        createdBy: req.user!.id,
      });

      await logAudit(req, "OVERLAY_CREATE", "policy_lender_overlay", overlay.id, {
        basePolicyProfileId: overlay.basePolicyProfileId,
        lenderId: overlay.lenderId,
        lenderName: overlay.lenderName,
      });

      res.status(201).json(overlay);
    } catch (error) {
      console.error("Create policy overlay error:", error);
      res.status(500).json({ error: "Failed to create policy overlay" });
    }
  });

  app.patch("/api/policy-overlays/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const overlay = await storage.getPolicyLenderOverlay(req.params.id);
      if (!overlay) {
        return res.status(404).json({ error: "Overlay not found" });
      }

      if (overlay.status === "ACTIVE" || overlay.status === "RETIRED") {
        return res.status(400).json({ error: `Cannot edit an overlay in ${overlay.status} status` });
      }

      const allowedFields = [
        "overlayThresholds", "additionalRequirements",
        "effectiveDate", "expirationDate",
      ];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      const updated = await storage.updatePolicyLenderOverlay(req.params.id, updates);

      await logAudit(req, "OVERLAY_UPDATE", "policy_lender_overlay", req.params.id, {
        lenderId: overlay.lenderId,
        updatedFields: Object.keys(updates),
      });

      res.json(updated);
    } catch (error) {
      console.error("Update policy overlay error:", error);
      res.status(500).json({ error: "Failed to update policy overlay" });
    }
  });

  app.delete("/api/policy-overlays/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const overlay = await storage.getPolicyLenderOverlay(req.params.id);
      if (!overlay) {
        return res.status(404).json({ error: "Overlay not found" });
      }

      if (overlay.status === "ACTIVE") {
        return res.status(400).json({ error: "Cannot delete an active overlay. Retire it first." });
      }

      await storage.deletePolicyLenderOverlay(req.params.id);

      await logAudit(req, "OVERLAY_DELETE", "policy_lender_overlay", req.params.id, {
        lenderId: overlay.lenderId,
        lenderName: overlay.lenderName,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Delete policy overlay error:", error);
      res.status(500).json({ error: "Failed to delete policy overlay" });
    }
  });

  // ============================================================================
  // POLICY APPROVAL HISTORY
  // ============================================================================

  app.get("/api/policy-approvals/:policyProfileId", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer", "broker", "lender"), async (req, res) => {
    try {
      const approvals = await storage.getPolicyApprovals(req.params.policyProfileId);
      res.json(approvals);
    } catch (error) {
      console.error("Get policy approvals error:", error);
      res.status(500).json({ error: "Failed to get policy approvals" });
    }
  });
}
