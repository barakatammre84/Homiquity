import type { Express } from "express";
import type { IStorage } from "../storage";
import { isAuthenticated, requireRole } from "../auth";
import { isStaffRole, isInternalStaffRole, type User } from "@shared/schema";
import { z } from "zod";
import * as creditService from "../services/creditService";

export function registerComplianceRoutes(
  app: Express,
  storage: IStorage,
) {
  // ============================================================================
  // PLAID VERIFICATION ROUTES
  // ============================================================================

  // Create a Plaid Link token for verification
  app.post("/api/verifications/link-token", isAuthenticated, async (req, res) => {
    try {
      const { applicationId, verificationType } = req.body;
      const userId = req.user!.id;

      if (!applicationId || !verificationType) {
        return res.status(400).json({ error: "applicationId and verificationType are required" });
      }

      // Verify ownership
      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { isPlaidConfigured, createLinkToken } = await import("../plaid");

      if (!isPlaidConfigured()) {
        return res.status(503).json({ 
          error: "Verification service not configured",
          message: "Please contact support to enable verification services."
        });
      }

      const result = await createLinkToken({
        userId,
        verificationType,
      });

      // Store the link token
      const expiresAt = new Date(result.expiration);
      const linkTokenRecord = await storage.createPlaidLinkToken({
        userId,
        applicationId,
        linkToken: result.linkToken,
        verificationType,
        status: "pending",
        expiresAt,
      });

      res.json({
        linkToken: result.linkToken,
        expiration: result.expiration,
        linkTokenId: linkTokenRecord.id,
      });
    } catch (error) {
      console.error("Create link token error:", error);
      res.status(500).json({ error: "Failed to create verification session" });
    }
  });

  // Exchange public token and process verification
  app.post("/api/verifications/exchange", isAuthenticated, async (req, res) => {
    try {
      const { publicToken, linkTokenId, applicationId, verificationType } = req.body;
      const userId = req.user!.id;

      if (!publicToken || !applicationId || !verificationType) {
        return res.status(400).json({ error: "publicToken, applicationId, and verificationType are required" });
      }

      // Verify ownership
      const application = await storage.getLoanApplication(applicationId);
      if (!application || application.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { isPlaidConfigured, exchangePublicToken, getIdentityData } = await import("../plaid");

      if (!isPlaidConfigured()) {
        return res.status(503).json({ error: "Verification service not configured" });
      }

      // Exchange the public token
      const { accessToken, itemId } = await exchangePublicToken(publicToken);

      // Create verification record
      const verification = await storage.createVerification({
        applicationId,
        userId,
        verificationType,
        plaidItemId: itemId,
        plaidAccessToken: accessToken,
        status: "in_progress",
        verificationMethod: "plaid_payroll",
      });

      // Update link token status if provided
      if (linkTokenId) {
        await storage.updatePlaidLinkToken(linkTokenId, { status: "completed" });
      }

      // For identity verification, fetch and store the data
      if (verificationType === "identity") {
        try {
          const identityResult = await getIdentityData(accessToken);
          await storage.updateVerification(verification.id, {
            status: identityResult.verified ? "verified" : "failed",
            identityVerified: identityResult.verified,
            rawResponse: identityResult.rawResponse,
            verifiedAt: identityResult.verified ? new Date() : undefined,
          });

          if (identityResult.verified) {
            try {
              const { wirePlaidToReadiness } = await import("../services/optimizationEngine");
              await wirePlaidToReadiness(userId, "identity", {
                itemId,
                fullName: identityResult.identityData.names[0] || null,
                addresses: identityResult.identityData.addresses,
                emails: identityResult.identityData.emails,
                phoneNumbers: identityResult.identityData.phoneNumbers,
                verified: true,
                verifiedAt: new Date().toISOString(),
              });
            } catch (readinessErr) {
              console.warn("[OPT-4] Plaid identity readiness wiring failed:", readinessErr);
            }
          }
        } catch (identityError) {
          console.error("Identity fetch error:", identityError);
          await storage.updateVerification(verification.id, {
            status: "failed",
            rawResponse: { error: String(identityError) },
          });
        }
      }

      // For employment verification, mark as pending review (webhook will update)
      if (verificationType === "employment" || verificationType === "income") {
        await storage.updateVerification(verification.id, {
          status: "in_progress",
        });

        try {
          const { wirePlaidToReadiness } = await import("../services/optimizationEngine");
          await wirePlaidToReadiness(userId, verificationType as "employment" | "income", {
            itemId,
            verificationType,
            verificationId: verification.id,
            status: "in_progress",
            initiatedAt: new Date().toISOString(),
          });
        } catch (readinessErr) {
          console.warn(`[OPT-4] Plaid ${verificationType} readiness wiring failed:`, readinessErr);
        }
      }

      res.json({
        verificationId: verification.id,
        status: verification.status,
        message: "Verification initiated successfully",
      });
    } catch (error) {
      console.error("Exchange token error:", error);
      res.status(500).json({ error: "Failed to process verification" });
    }
  });

  // Get verifications for an application
  app.get("/api/verifications/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const { applicationId } = req.params;
      const userId = req.user!.id;
      const userRole = req.user?.role || "";

      // Borrowers must own the application.
      // Internal staff (including non-admin roles like lo/loa/processor/underwriter/closer)
      // must be assigned to the application — getLoanApplicationWithAccess grants blanket
      // access to all internal staff, which is too broad for sensitive verification records.
      // External partners (broker/lender) follow the deal-team path via getLoanApplicationWithAccess.
      if (isInternalStaffRole(userRole)) {
        const application = await storage.getLoanApplication(applicationId);
        if (!application) {
          return res.status(403).json({ error: "Access denied" });
        }
        if (userRole !== "admin") {
          const teamMembers = await storage.getDealTeamMembers(applicationId);
          const isMember = teamMembers.some(m => m.userId === userId);
          if (!isMember) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      } else {
        // Borrower ownership check and broker/lender deal-team check.
        const application = await storage.getLoanApplicationWithAccess(applicationId, userId, userRole);
        if (!application) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const verifications = await storage.getVerificationsByApplication(applicationId);
      // Strip server-only secrets before sending to the client. plaidAccessToken is a
      // bearer credential for the linked Plaid item and must never reach the browser.
      // rawResponse may contain raw identity/financial payloads.
      const safeVerifications = verifications.map(({ plaidAccessToken, rawResponse, ...safe }) => safe);
      res.json(safeVerifications);
    } catch (error) {
      console.error("Get verifications error:", error);
      res.status(500).json({ error: "Failed to get verifications" });
    }
  });

  // Get verification status
  app.get("/api/verifications/:id", isAuthenticated, async (req, res) => {
    try {
      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      const userId = req.user!.id;
      const userRole = req.user?.role || "";
      const isInternalStaff = isInternalStaffRole(userRole);
      const isOwner = verification.userId === userId;

      if (!isOwner) {
        // All non-owner callers (including internal staff) must be confirmed as
        // deal-team members on the linked application. This prevents unrelated
        // staff from harvesting raw Plaid payloads for files they are not assigned to.
        if (!verification.applicationId) {
          return res.status(403).json({ error: "Unauthorized" });
        }
        if (isInternalStaff) {
          // Admin always passes; all other internal staff must be on the deal team.
          if (userRole !== "admin") {
            const teamMembers = await storage.getDealTeamMembers(verification.applicationId);
            const isMember = teamMembers.some(m => m.userId === userId);
            if (!isMember) {
              return res.status(403).json({ error: "Unauthorized" });
            }
          }
        } else if (userRole === "broker" || userRole === "lender") {
          // External partner (broker/lender) must be a deal-team member.
          const assignedApp = await storage.getLoanApplicationWithAccess(
            verification.applicationId, userId, userRole
          );
          if (!assignedApp) {
            return res.status(403).json({ error: "Unauthorized" });
          }
        } else {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      // Strip plaidAccessToken (bearer credential) always.
      // rawResponse can contain raw Plaid identity payloads; restrict to internal staff.
      const { plaidAccessToken, rawResponse, ...baseVerification } = verification;
      const safeVerification = isInternalStaff
        ? { ...baseVerification, rawResponse }
        : baseVerification;
      res.json(safeVerification);
    } catch (error) {
      console.error("Get verification error:", error);
      res.status(500).json({ error: "Failed to get verification" });
    }
  });

  // Staff: Update verification status (approve/reject)
  // Restricted to internal staff roles only; broker/lender partner accounts must not
  // be able to approve or reject another borrower's verification.
  app.patch("/api/verifications/:id", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ error: "Verification not found" });
      }

      // Verify the caller is assigned to the application this verification belongs to.
      // Admins always pass; all other staff must be active deal-team members.
      // If there is no applicationId on the record, non-admin access is denied by default.
      const userId = req.user!.id;
      const userRole = req.user!.role;
      if (userRole !== "admin") {
        if (!verification.applicationId) {
          return res.status(403).json({ error: "Not authorized to review this verification" });
        }
        const teamMembers = await storage.getDealTeamMembers(verification.applicationId);
        const isMember = teamMembers.some(m => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ error: "Not authorized to review this verification" });
        }
      }

      const { status, reviewNotes } = req.body;
      const updated = await storage.updateVerification(req.params.id, {
        status,
        reviewNotes,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        verifiedAt: status === "verified" ? new Date() : undefined,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update verification error:", error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  // Check if Plaid is configured
  app.get("/api/verifications/config/status", isAuthenticated, async (req, res) => {
    try {
      const { isPlaidConfigured } = await import("../plaid");
      res.json({
        plaidConfigured: isPlaidConfigured(),
        supportedVerificationTypes: ["employment", "identity", "income", "assets"],
      });
    } catch (error) {
      res.json({ plaidConfigured: false, supportedVerificationTypes: [] });
    }
  });

  // ==========================================================================
  // CREDIT & FCRA COMPLIANCE ENDPOINTS
  // ==========================================================================

  // Get disclosure text for consent form
  app.get("/api/credit/disclosure", isAuthenticated, async (req, res) => {
    try {
      const stateCode = req.query.state as string | undefined;
      res.json({
        disclosureText: creditService.getCombinedDisclosure(stateCode),
        disclosureVersion: creditService.getDisclosureVersion(),
        stateRules: stateCode ? creditService.getStateDisclosureRules(stateCode) : null,
      });
    } catch (error) {
      console.error("Get disclosure error:", error);
      res.status(500).json({ error: "Failed to get disclosure" });
    }
  });

  app.get("/api/credit/state-rules", isAuthenticated, async (req, res) => {
    try {
      const stateCode = req.query.state as string | undefined;
      if (stateCode) {
        res.json({ rules: creditService.getStateDisclosureRules(stateCode) });
      } else {
        res.json({ rules: creditService.getAllStateDisclosureRules() });
      }
    } catch (error) {
      console.error("Get state rules error:", error);
      res.status(500).json({ error: "Failed to get state rules" });
    }
  });

  // Get active consent for an application
  // Restricted to the borrower who owns the application and internal staff only.
  // Broker/lender partner accounts must not access raw consent records because the
  // credit_consents table stores SSN last-4, DOB, and other PII.
  app.get("/api/loan-applications/:id/credit/consent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;

      if (user.role === "broker" || user.role === "lender") {
        return res.status(403).json({ error: "Access denied" });
      }

      if (isInternalStaffRole(user.role)) {
        // Admin has unrestricted access; all other internal staff must be on the deal team.
        if (user.role !== "admin") {
          const teamMembers = await storage.getDealTeamMembers(req.params.id);
          const isMember = teamMembers.some(m => m.userId === user.id);
          if (!isMember) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      } else {
        // Borrower path: must own the application.
        const application = await storage.getLoanApplication(req.params.id);
        if (!application || application.userId !== user.id) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const consent = await creditService.getActiveConsent(req.params.id);
      res.json({ consent });
    } catch (error) {
      console.error("Get consent error:", error);
      res.status(500).json({ error: "Failed to get consent" });
    }
  });

  // Submit credit consent
  app.post("/api/loan-applications/:id/credit/consent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Only the borrower can provide consent" });
      }
      
      const { consentType, borrowerFullName, borrowerSSNLast4, borrowerDOB, consentGiven } = req.body;
      
      if (!borrowerFullName || consentGiven === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (consentGiven !== true) {
        return res.status(400).json({ error: "Affirmative consent is required to proceed with a credit check" });
      }

      if (borrowerSSNLast4 !== undefined && borrowerSSNLast4 !== null) {
        const ssnLast4Str = String(borrowerSSNLast4);
        if (!/^\d{4}$/.test(ssnLast4Str)) {
          return res.status(400).json({ error: "SSN last 4 digits must be exactly 4 numeric digits" });
        }
      }
      
      const consent = await creditService.createCreditConsent({
        applicationId: req.params.id,
        userId: user.id,
        consentType: consentType || "hard_pull",
        borrowerFullName,
        borrowerSSNLast4,
        borrowerDOB,
        consentGiven,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      
      res.status(201).json({ consent });
    } catch (error) {
      console.error("Create consent error:", error);
      res.status(500).json({ error: "Failed to create consent" });
    }
  });

  // Revoke consent
  // Only the borrower who gave consent, or internal staff (admin, lo, loa, processor,
  // underwriter, closer) may revoke it. External partner accounts (broker/lender) must
  // not be able to revoke another party's consent — doing so could disrupt regulated
  // credit workflows and exposes stored PII to confirmation-of-revocation flows.
  app.post("/api/credit/consent/:consentId/revoke", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { reason } = req.body;

      const consent = await creditService.getConsentById(req.params.consentId);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }

      const isOwner = consent.userId === user.id;
      if (!isOwner) {
        // Only internal staff may revoke on behalf of a borrower.
        // External partner roles (broker/lender) are explicitly denied.
        if (!isInternalStaffRole(user.role)) {
          return res.status(403).json({ error: "Access denied" });
        }
        // Non-admin internal staff must be assigned to the linked application.
        if (user.role !== "admin" && consent.applicationId) {
          const teamMembers = await storage.getDealTeamMembers(consent.applicationId);
          const isMember = teamMembers.some(m => m.userId === user.id);
          if (!isMember) {
            return res.status(403).json({ error: "Access denied" });
          }
        }
      }

      await creditService.revokeConsent(
        req.params.consentId,
        reason || "Borrower requested revocation",
        user.id,
        req.ip
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Revoke consent error:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  app.get("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const draft = await creditService.getDraftConsent(req.params.id, user.id);
      res.json({ draft });
    } catch (error) {
      console.error("Get draft consent error:", error);
      res.status(500).json({ error: "Failed to get draft consent" });
    }
  });

  app.post("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Only the borrower can save draft consent" });
      }
      
      const draft = await creditService.saveDraftConsent(req.params.id, user.id, req.body);
      res.json({ draft });
    } catch (error) {
      console.error("Save draft consent error:", error);
      res.status(500).json({ error: "Failed to save draft consent" });
    }
  });

  app.delete("/api/loan-applications/:id/credit/draft", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplication(req.params.id);
      
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      if (application.userId !== user.id) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await creditService.deleteDraftConsent(req.params.id, user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete draft consent error:", error);
      res.status(500).json({ error: "Failed to delete draft consent" });
    }
  });

  // Request credit pull (internal staff only — broker/lender excluded)
  app.post("/api/loan-applications/:id/credit/pull", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Non-admin staff must be assigned to the application before they can
      // initiate a credit pull, which is a regulated FCRA action.
      if (user.role !== "admin") {
        const teamMembers = await storage.getDealTeamMembers(req.params.id);
        const isMember = teamMembers.some(m => m.userId === user.id);
        if (!isMember) {
          return res.status(403).json({ error: "You are not assigned to this application" });
        }
      }
      
      const consent = await creditService.getActiveConsent(req.params.id);
      if (!consent) {
        return res.status(400).json({ error: "Valid consent required before credit pull" });
      }
      
      const { pullType, bureaus } = req.body;
      
      const pull = await creditService.requestCreditPull({
        applicationId: req.params.id,
        consentId: consent.id,
        requestedBy: user.id,
        pullType: pullType || "tri_merge",
        bureaus: bureaus || ["experian", "equifax", "transunion"],
        ipAddress: req.ip,
      });
      
      // In simulation mode, immediately complete the pull
      const completedPull = await creditService.simulateCreditPullCompletion(pull.id);
      
      // Update loan application with the representative credit score
      if (completedPull.representativeScore) {
        await storage.updateLoanApplication(req.params.id, {
          creditScore: completedPull.representativeScore,
        });
      }
      
      res.status(201).json({ pull: completedPull });
    } catch (error) {
      console.error("Request credit pull error:", error);
      res.status(500).json({ error: "Failed to request credit pull" });
    }
  });

  // Get credit pulls for an application
  app.get("/api/loan-applications/:id/credit/pulls", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const pulls = await creditService.getCreditPullsByApplication(req.params.id);
      res.json({ pulls });
    } catch (error) {
      console.error("Get credit pulls error:", error);
      res.status(500).json({ error: "Failed to get credit pulls" });
    }
  });

  // Get latest credit pull for an application
  app.get("/api/loan-applications/:id/credit/latest", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const pull = await creditService.getLatestCreditPull(req.params.id);
      res.json({ pull });
    } catch (error) {
      console.error("Get latest credit pull error:", error);
      res.status(500).json({ error: "Failed to get latest credit pull" });
    }
  });

  // Get adverse action reasons list
  app.get("/api/credit/adverse-action-reasons", isAuthenticated, async (req, res) => {
    try {
      res.json({ reasons: creditService.getAdverseActionReasons() });
    } catch (error) {
      console.error("Get adverse action reasons error:", error);
      res.status(500).json({ error: "Failed to get adverse action reasons" });
    }
  });

  // Get detailed adverse action reasons with bureau codes
  app.get("/api/credit/adverse-action-reasons/detailed", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      res.json({ reasons: creditService.getAdverseActionReasonsDetailed() });
    } catch (error) {
      console.error("Get detailed adverse action reasons error:", error);
      res.status(500).json({ error: "Failed to get detailed adverse action reasons" });
    }
  });

  // Get retention policies
  app.get("/api/credit/retention-policies", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      res.json({ policies: creditService.getRetentionPolicies() });
    } catch (error) {
      console.error("Get retention policies error:", error);
      res.status(500).json({ error: "Failed to get retention policies" });
    }
  });

  // Get retention compliance report
  app.get("/api/credit/retention-report", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const report = await creditService.getRetentionComplianceReport();
      res.json(report);
    } catch (error) {
      console.error("Get retention report error:", error);
      res.status(500).json({ error: "Failed to get retention report" });
    }
  });

  // Get application retention status
  app.get("/api/loan-applications/:id/retention-status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      // Use getLoanApplicationWithAccess so broker/lender are validated against
      // deal-team membership; non-staff (borrowers) are blocked entirely since
      // retention status is an operational metric, not a borrower-facing resource.
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const status = await creditService.getApplicationRetentionStatus(req.params.id);
      res.json(status);
    } catch (error) {
      console.error("Get retention status error:", error);
      res.status(500).json({ error: "Failed to get retention status" });
    }
  });

  // Archive credit pull (internal staff only — must be assigned to the application)
  app.post("/api/credit/pulls/:pullId/archive", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      // Resolve the pull to its parent application so we can enforce assignment.
      const pull = await creditService.getCreditPullById(req.params.pullId);
      if (!pull) {
        return res.status(404).json({ error: "Credit pull not found" });
      }

      if (user.role !== "admin") {
        const teamMembers = await storage.getDealTeamMembers(pull.applicationId);
        const isMember = teamMembers.some(m => m.userId === user.id);
        if (!isMember) {
          return res.status(403).json({ error: "You are not assigned to this application" });
        }
      }

      const { reason } = req.body;
      await creditService.archiveCreditPull(req.params.pullId, reason || "Retention policy", user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Archive credit pull error:", error);
      res.status(500).json({ error: "Failed to archive credit pull" });
    }
  });

  // Get archive-eligible records
  app.get("/api/credit/archive-eligible", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }
      const eligible = await creditService.getArchiveEligibleRecords();
      res.json(eligible);
    } catch (error) {
      console.error("Get archive eligible error:", error);
      res.status(500).json({ error: "Failed to get archive eligible records" });
    }
  });

  // Zod schema for adverse action request validation
  const adverseActionRequestSchema = z.object({
    actionType: z.enum(["denial", "counteroffer", "rate_adjustment", "terms_change"]),
    primaryReason: z.string().refine(
      (val) => creditService.validateAdverseActionReason(val),
      { message: `Invalid primary reason key. Must be one of: ${creditService.getValidAdverseActionReasonKeys().join(", ")}` }
    ),
    secondaryReasons: z.array(
      z.string().refine(
        (val) => creditService.validateAdverseActionReason(val),
        { message: `Invalid secondary reason key. Must be one of: ${creditService.getValidAdverseActionReasonKeys().join(", ")}` }
      )
    ).optional(),
    creditPullId: z.string().uuid().optional(),
    creditScoreUsed: z.number().min(300).max(850).optional(),
    creditScoreSource: z.enum(["experian", "equifax", "transunion"]).optional(),
  });

  // Generate adverse action notice (internal staff only — broker/lender excluded)
  app.post("/api/loan-applications/:id/credit/adverse-action", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }
      
      const application = await storage.getLoanApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Non-admin internal staff must be assigned to the application to generate
      // an adverse-action notice — this is a regulated, borrower-facing credit action.
      if (user.role !== "admin") {
        const teamMembers = await storage.getDealTeamMembers(req.params.id);
        const isMember = teamMembers.some(m => m.userId === user.id);
        if (!isMember) {
          return res.status(403).json({ error: "You are not assigned to this application" });
        }
      }
      
      // Validate request body using Zod schema
      const parseResult = adverseActionRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.errors.map(e => e.message).join("; ");
        return res.status(400).json({ error: errorMessages });
      }
      
      const { 
        actionType, 
        primaryReason, 
        secondaryReasons, 
        creditPullId,
        creditScoreUsed,
        creditScoreSource,
      } = parseResult.data;
      
      const adverseAction = await creditService.generateAdverseAction({
        applicationId: req.params.id,
        creditPullId,
        userId: application.userId,
        actionType,
        primaryReason,
        secondaryReasons,
        creditScoreUsed,
        creditScoreSource,
        generatedBy: user.id,
      });
      
      res.status(201).json({ adverseAction });
    } catch (error) {
      console.error("Generate adverse action error:", error);
      res.status(500).json({ error: "Failed to generate adverse action" });
    }
  });

  // Get adverse actions for an application
  app.get("/api/loan-applications/:id/credit/adverse-actions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const adverseActions = await creditService.getAdverseActionsByApplication(req.params.id);
      res.json({ adverseActions });
    } catch (error) {
      console.error("Get adverse actions error:", error);
      res.status(500).json({ error: "Failed to get adverse actions" });
    }
  });

  // Mark adverse action as delivered (internal staff only — must be assigned to the application)
  app.post("/api/credit/adverse-action/:actionId/deliver", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff access required" });
      }

      // Resolve the adverse action to its parent application before authorizing.
      const action = await creditService.getAdverseActionById(req.params.actionId);
      if (!action) {
        return res.status(404).json({ error: "Adverse action not found" });
      }

      if (user.role !== "admin") {
        const teamMembers = await storage.getDealTeamMembers(action.applicationId);
        const isMember = teamMembers.some(m => m.userId === user.id);
        if (!isMember) {
          return res.status(403).json({ error: "You are not assigned to this application" });
        }
      }
      
      const { deliveryMethod, deliveryConfirmation } = req.body;
      
      await creditService.markAdverseActionDelivered(
        req.params.actionId,
        deliveryMethod || "in_app",
        deliveryConfirmation
      );
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark adverse action delivered error:", error);
      res.status(500).json({ error: "Failed to mark adverse action as delivered" });
    }
  });

  // Get credit audit log for an application (internal staff only)
  app.get("/api/loan-applications/:id/credit/audit-log", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      // Use getLoanApplicationWithAccess: broker/lender must be deal-team members.
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const auditLog = await creditService.getCreditAuditLog(req.params.id, limit);
      res.json({ auditLog });
    } catch (error) {
      console.error("Get credit audit log error:", error);
      res.status(500).json({ error: "Failed to get credit audit log" });
    }
  });

  app.get("/api/loan-applications/:id/credit/audit-log/verify", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const result = await creditService.verifyAuditLogIntegrity(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Verify audit log error:", error);
      res.status(500).json({ error: "Failed to verify audit log" });
    }
  });

  app.get("/api/loan-applications/:id/credit/audit-log/export", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff access required" });
      }
      
      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const format = req.query.format as string || "json";
      
      if (format === "csv") {
        const csv = await creditService.generateCSVExport(req.params.id);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="audit-log-${req.params.id}.csv"`);
        res.send(csv);
      } else {
        const exportPackage = await creditService.generateAuditExportPackage(req.params.id, user.id);
        res.json(exportPackage);
      }
    } catch (error) {
      console.error("Export audit log error:", error);
      res.status(500).json({ error: "Failed to export audit log" });
    }
  });

  // Get comprehensive credit summary for an application
  // The full consent record contains PII (SSN last-4, DOB, etc.) and must only be
  // returned to the borrower who submitted it or to assigned internal staff.
  // External partners (broker/lender) may learn whether active consent exists but
  // must not receive the raw consent payload.
  app.get("/api/loan-applications/:id/credit/summary", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const isExternalPartner = user.role === "broker" || user.role === "lender";

      const application = await storage.getLoanApplicationWithAccess(req.params.id, user.id, user.role);
      
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const [consent, latestPull, pulls, adverseActions] = await Promise.all([
        creditService.getActiveConsent(req.params.id),
        creditService.getLatestCreditPull(req.params.id),
        creditService.getCreditPullsByApplication(req.params.id),
        creditService.getAdverseActionsByApplication(req.params.id),
      ]);
      
      res.json({
        hasActiveConsent: !!consent,
        // Redact raw consent object for external partner roles to protect PII
        // (borrowerFullName, borrowerSSNLast4, borrowerDOB, ipAddress, userAgent).
        consent: isExternalPartner ? null : consent,
        latestPull,
        pullCount: pulls.length,
        adverseActionCount: adverseActions.length,
        latestAdverseAction: adverseActions[0] || null,
      });
    } catch (error) {
      console.error("Get credit summary error:", error);
      res.status(500).json({ error: "Failed to get credit summary" });
    }
  });

  // ============================================================================
  // HMDA DEMOGRAPHIC DATA COLLECTION (Regulation C Compliance)
  // ============================================================================

  app.get("/api/loan-applications/:id/hmda", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { hmdaDemographics } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");

      const [record] = await database.select().from(hmdaDemographics)
        .where(eq(hmdaDemographics.applicationId, id))
        .limit(1);

      res.json({ demographics: record || null });
    } catch (error) {
      console.error("Get HMDA demographics error:", error);
      res.status(500).json({ error: "Failed to get demographic data" });
    }
  });

  app.post("/api/loan-applications/:id/hmda", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;

      const application = await storage.getLoanApplicationWithAccess(id, user.id, user.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const { db: database } = await import("../db");
      const { hmdaDemographics, insertHmdaDemographicsSchema } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const validationSchema = insertHmdaDemographicsSchema.omit({
        applicationId: true,
        borrowerId: true,
        collectionMethod: true,
      });

      const parsed = validationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid demographic data", details: parsed.error.flatten() });
      }

      const collectionMethod = isStaffRole(user.role) ? "loan_officer" : "borrower";

      const [existing] = await database.select().from(hmdaDemographics)
        .where(eq(hmdaDemographics.applicationId, id))
        .limit(1);

      let record;
      if (existing) {
        [record] = await database.update(hmdaDemographics)
          .set({
            ...parsed.data,
            collectionMethod,
            updatedAt: new Date(),
          })
          .where(eq(hmdaDemographics.id, existing.id))
          .returning();
      } else {
        [record] = await database.insert(hmdaDemographics).values({
          ...parsed.data,
          applicationId: id,
          borrowerId: application.userId,
          collectionMethod,
        }).returning();
      }

      const { logAudit } = await import("../auditLog");
      logAudit(req, "hmda_demographics.saved", "hmda_demographics", record.id);

      res.json({ demographics: record });
    } catch (error) {
      console.error("Save HMDA demographics error:", error);
      res.status(500).json({ error: "Failed to save demographic data" });
    }
  });
}
