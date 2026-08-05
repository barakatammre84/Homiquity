// Borrower routes: Deal-team membership CRUD, application withdraw, LO assignment, staff lists.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { isAdmin } from "@shared/roles";
import { type IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import { isStaffRole, isInternalStaffRole, LOAN_APP_TERMINAL_STATUSES, type User } from "@shared/schema";
import { updatePipelineStage } from "../../pipelineEngine";
import { z } from "zod";
import { routeParams } from "../../http/routeParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).

export function registerDealTeamRoutes(
  app: Express,
  storage: IStorage,
) {
  // Get team members for an application
  app.get("/api/applications/:applicationId/team", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = routeParams(req);

      // Verify access to application
      const app = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const team = await storage.getDealTeamMembers(applicationId);
      res.json(team);
    } catch (error) {
      console.error("Get deal team error:", error);
      res.status(500).json({ error: "Failed to get team members" });
    }
  });

  // Add team member to application (admin only).
  // Deal-team membership is the authorization boundary for partner file access,
  // so only admins may expand it to prevent silent self-grant escalations.
  app.post("/api/applications/:applicationId/team", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;

      const { applicationId } = routeParams(req);
      const schema = z.object({
        userId: z.string().optional(),
        teamRole: z.string().min(1),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Verify application exists
      const app = await storage.getLoanApplication(applicationId);
      if (!app) {
        return res.status(404).json({ error: "Application not found" });
      }

      const member = await storage.createDealTeamMember({
        ...result.data,
        applicationId,
        assignedBy: user.id,
        assignedAt: new Date(),
      });

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "team_updated",
        title: "Team member added",
        description: `${result.data.externalName || 'Team member'} added as ${result.data.teamRole.replace(/_/g, ' ')}`,
        performedBy: user.id,
      });

      res.status(201).json(member);
    } catch (error) {
      console.error("Add team member error:", error);
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  // Withdraw/cancel loan application (borrower can withdraw their own apps)
  app.post("/api/loan-applications/:applicationId/withdraw", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = routeParams(req);

      const schema = z.object({
        reason: z.string().min(1),
        details: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      // Get the application
      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Borrowers may withdraw their own application.
      // Internal staff may withdraw a file they are assigned to.
      // External partner roles (broker/lender) must not be able to place another
      // borrower's application into a terminal state.
      if (application.userId !== user.id) {
        if (!isInternalStaffRole(user.role)) {
          return res.status(403).json({ error: "You can only withdraw your own applications" });
        }
        // Non-admin internal staff must be on the deal team.
        if (!isAdmin(user)) {
          const teamMembers = await storage.getDealTeamMembers(applicationId);
          const isMember = teamMembers.some(m => m.userId === user.id);
          if (!isMember) {
            return res.status(403).json({ error: "You are not assigned to this application" });
          }
        }
      }

      // Check if already withdrawn or in a terminal state
      if ((LOAN_APP_TERMINAL_STATUSES as readonly string[]).includes(application.status)) {
        return res.status(400).json({ error: "Application cannot be withdrawn in its current state" });
      }

      // Single writer: stamps the HMDA Reg C action-taken code 4 (previously
      // missed on borrower-initiated withdrawals), emits task-engine events,
      // and keeps the borrower state machine in sync.
      await updatePipelineStage(applicationId, "withdrawn");
      const updatedApp = await storage.getLoanApplication(applicationId);

      // Log the withdrawal activity
      await storage.createDealActivity({
        applicationId,
        activityType: "application_withdrawn",
        title: "Application Withdrawn",
        description: `Application withdrawn by ${user.role === "borrower" ? "borrower" : "staff"}. Reason: ${result.data.reason}${result.data.details ? `. Details: ${result.data.details}` : ""}`,
        performedBy: user.id,
        metadata: {
          reason: result.data.reason,
          details: result.data.details || "",
          withdrawnAt: new Date().toISOString(),
        },
      });

      res.json({ success: true, application: updatedApp });
    } catch (error) {
      console.error("Withdraw application error:", error);
      res.status(500).json({ error: "Failed to withdraw application" });
    }
  });

  // Update team member (admin only).
  // Restricting to admin prevents non-admin staff from modifying team membership,
  // which is the authorization boundary for partner file access.
  app.patch("/api/deal-team/:id", requireRole("admin"), async (req, res) => {
    try {

      const { id } = routeParams(req);
      const schema = z.object({
        teamRole: z.string().optional(),
        externalName: z.string().optional(),
        externalEmail: z.string().email().optional(),
        externalPhone: z.string().optional(),
        externalCompany: z.string().optional(),
        isPrimary: z.boolean().optional(),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const existingMember = await storage.getDealTeamMember(id);
      if (!existingMember) {
        return res.status(404).json({ error: "Team member not found" });
      }

      const updated = await storage.updateDealTeamMember(id, result.data);
      if (!updated) {
        return res.status(404).json({ error: "Team member not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Update team member error:", error);
      res.status(500).json({ error: "Failed to update team member" });
    }
  });

  // Remove team member (admin only).
  // Restricting to admin prevents removal of legitimate team members and
  // protects the assignment model that authorizes partner file access.
  app.delete("/api/deal-team/:id", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;

      const { id } = routeParams(req);
      
      const member = await storage.getDealTeamMember(id);
      if (!member) {
        return res.status(404).json({ error: "Team member not found" });
      }

      await storage.removeDealTeamMember(id);

      // Log activity
      await storage.createDealActivity({
        applicationId: member.applicationId,
        activityType: "team_updated",
        title: "Team member removed",
        description: `Team member removed from ${member.teamRole.replace(/_/g, ' ')} role`,
        performedBy: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove team member error:", error);
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // Assign (or clear) the loan officer on an application (admin only).
  // The loanOfficerId is what grants LO/LOA object-level access to the file
  // (see access checks in borrower.ts / task-engine.ts / agent-broker.ts), so
  // restricting mutation to admin keeps that authorization boundary tight.
  app.patch("/api/loan-applications/:applicationId/loan-officer", requireRole("admin"), async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = routeParams(req);

      const schema = z.object({
        loanOfficerId: z.string().min(1).nullable(),
      });
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const application = await storage.getLoanApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // When assigning (non-null), the target must be an internal loan-officer user.
      if (result.data.loanOfficerId) {
        const target = await storage.getUser(result.data.loanOfficerId);
        if (!target || (target.role !== "lo" && target.role !== "loa")) {
          return res.status(400).json({ error: "Assigned user must be a loan officer (lo or loa)" });
        }
      }

      // Atomic: also keeps the deal-team membership row in lockstep so the
      // assigned LO can actually open the file and see it in their queue.
      const updated = await storage.assignLoanOfficer(
        applicationId,
        result.data.loanOfficerId,
        user.id,
      );

      await storage.createDealActivity({
        applicationId,
        activityType: "team_updated",
        title: result.data.loanOfficerId ? "Loan officer assigned" : "Loan officer unassigned",
        description: result.data.loanOfficerId
          ? "A loan officer was assigned to this file."
          : "The loan officer was removed from this file.",
        performedBy: user.id,
      });

      res.json({ success: true, application: updated });
    } catch (error) {
      console.error("Assign loan officer error:", error);
      res.status(500).json({ error: "Failed to assign loan officer" });
    }
  });

  // Get all applications where user is a team member (for staff)
  app.get("/api/my-team-assignments", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const assignments = await storage.getTeamMembersByUser(user.id);
      res.json(assignments);
    } catch (error) {
      console.error("Get team assignments error:", error);
      res.status(500).json({ error: "Failed to get assignments" });
    }
  });

  // Get available staff for team assignment
  app.get("/api/available-staff", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isStaffRole(user.role)) {
        return res.status(403).json({ error: "Staff only" });
      }

      const allUsers = await storage.getAllUsers();
      const staffMembers = allUsers.filter(u => isStaffRole(u.role));
      
      // Return minimal info for privacy
      const staff = staffMembers.map(s => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        role: s.role,
      }));

      res.json(staff);
    } catch (error) {
      console.error("Get available staff error:", error);
      res.status(500).json({ error: "Failed to get staff" });
    }
  });

  // ============================================================================
}
