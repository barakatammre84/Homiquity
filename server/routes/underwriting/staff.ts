// Underwriting routes: Staff application/user lists + underwriting snapshots.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import type { IStorage } from "../../storage";
import { isAuthenticated, requireRole } from "../../auth";
import type { User } from "@shared/schema";
import * as creditService from "../../services/creditService";

export function registerStaffRoutes(
  app: Express,
  storage: IStorage,
) {
  app.get("/api/staff/applications", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      let applications: Awaited<ReturnType<typeof storage.getAllLoanApplications>>;
      if (user.role === "admin") {
        applications = await storage.getAllLoanApplications();
      } else {
        const memberships = await storage.getTeamMembersByUser(user.id);
        const byId = new Map<string, NonNullable<(typeof memberships)[number]["application"]>>();
        for (const m of memberships) {
          if (m.application) byId.set(m.application.id, m.application);
        }
        applications = [...byId.values()];
      }
      res.json(applications);
    } catch (error) {
      console.error("Get staff applications error:", error);
      res.status(500).json({ error: "Failed to get applications" });
    }
  });

  // Staff-scoped user directory for label resolution (borrower/assignee names) on
  // the internal dashboard. Returns a MINIMAL name-only projection — never
  // credential or full-profile fields. Admin resolves against all users; a
  // non-admin internal-staff member resolves only against the internal-staff team
  // directory plus the borrowers on their own deal-team applications. This is the
  // least-privilege, non-admin equivalent of the admin-only GET /api/admin/users.
  app.get("/api/staff/users", requireRole("admin", "lo", "loa", "processor", "underwriter", "closer"), async (req, res) => {
    try {
      const user = req.user as User;
      let directory: User[];
      if (user.role === "admin") {
        directory = await storage.getAllUsers();
      } else {
        const memberships = await storage.getTeamMembersByUser(user.id);
        const borrowerIds = [...new Set(
          memberships.map(m => m.application?.userId).filter((id): id is string => !!id)
        )];
        const [staff, borrowers] = await Promise.all([
          storage.getTeamMembersWithPresence(),
          borrowerIds.length ? storage.getUsersByIds(borrowerIds) : Promise.resolve([] as User[]),
        ]);
        const byId = new Map<string, User>();
        for (const u of staff) byId.set(u.id, u as User);
        for (const u of borrowers) byId.set(u.id, u);
        directory = [...byId.values()];
      }
      res.json(directory.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
      })));
    } catch (error) {
      console.error("Get staff user directory error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/loan-applications/:id/underwriting-snapshots", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getLoanApplicationWithAccess(id, req.user!.id, req.user!.role);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      const snapshots = await storage.getUnderwritingSnapshotsByApplication(id);
      res.json(snapshots);
    } catch (error) {
      console.error("Get underwriting snapshots error:", error);
      res.status(500).json({ error: "Failed to get underwriting snapshots" });
    }
  });

}
