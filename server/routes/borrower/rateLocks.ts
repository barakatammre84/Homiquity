// Borrower routes: Rate locks: create/list/expiring/extend/cancel.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { isInternalStaffRole, OPEN_RATE_LOCK_STATUSES, type User } from "@shared/schema";
import { z } from "zod";
import { firstQueryValue } from "../queryParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).
import { verifyInternalStaffApplicationAccess } from "./access";

export function registerRateLockRoutes(
  app: Express,
  storage: IStorage,
) {
  // Create a rate lock
  app.post("/api/rate-locks", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can create rate locks" });
      }

      const schema = z.object({
        applicationId: z.string(),
        loanOptionId: z.string(),
        lockPeriodDays: z.number().min(15).max(90).default(30),
        notes: z.string().optional(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const { applicationId, loanOptionId, lockPeriodDays, notes } = result.data;

      // Verify caller is assigned to this application (assignment-scoped; not platform-wide)
      const rateLockAllowed = await verifyInternalStaffApplicationAccess(storage, applicationId, user.id, user.role);
      if (!rateLockAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      // Check if there's already an active lock
      const existingLock = await storage.getActiveRateLock(applicationId);
      if (existingLock) {
        return res.status(400).json({ error: "Application already has an active rate lock" });
      }

      // Get the loan option details
      const options = await storage.getLoanOptionsByApplication(applicationId);
      const loanOption = options.find(o => o.id === loanOptionId);
      if (!loanOption) {
        return res.status(404).json({ error: "Loan option not found" });
      }

      const lockedAt = new Date();
      const expiresAt = new Date(lockedAt.getTime() + lockPeriodDays * 24 * 60 * 60 * 1000);

      const rateLock = await storage.createRateLock({
        applicationId,
        loanOptionId,
        interestRate: loanOption.interestRate,
        points: loanOption.points,
        loanAmount: loanOption.loanAmount,
        loanType: loanOption.loanType,
        loanTerm: loanOption.loanTerm,
        lockPeriodDays,
        lockedAt,
        expiresAt,
        status: "active",
        lockedBy: user.id,
        notes,
      });

      // Also update the loan option
      await storage.lockLoanOption(loanOptionId);

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: `Rate locked at ${loanOption.interestRate}% for ${lockPeriodDays} days`,
        metadata: { rateLockId: rateLock.id },
        performedBy: user.id,
      });

      res.status(201).json(rateLock);
    } catch (error) {
      console.error("Create rate lock error:", error);
      res.status(500).json({ error: "Failed to create rate lock" });
    }
  });

  // Get rate locks for an application
  app.get("/api/rate-locks/application/:applicationId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { applicationId } = req.params;
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const locks = await storage.getRateLocksByApplication(applicationId);
      res.json(locks);
    } catch (error) {
      console.error("Get rate locks error:", error);
      res.status(500).json({ error: "Failed to get rate locks" });
    }
  });

  // Get expiring rate locks (for alerts)
  app.get("/api/rate-locks/expiring", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only" });
      }

      const withinDays = parseInt(firstQueryValue(req.query.days) ?? "") || 7;
      const locks = await storage.getExpiringRateLocks(withinDays);

      // Assignment-scoped, mirroring GET /api/pipeline/queue: an admin sees
      // every expiring lock; every other internal-staff role sees only locks
      // on files they are an active deal-team member of.
      if (user.role === "admin") {
        return res.json(locks);
      }
      const memberships = await storage.getTeamMembersByUser(user.id);
      const allowedAppIds = new Set(
        memberships.map((m) => m.application?.id).filter((id): id is string => Boolean(id)),
      );
      res.json(locks.filter((lock) => allowedAppIds.has(lock.applicationId)));
    } catch (error) {
      console.error("Get expiring locks error:", error);
      res.status(500).json({ error: "Failed to get expiring locks" });
    }
  });

  // Extend a rate lock
  app.post("/api/rate-locks/:id/extend", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can extend rate locks" });
      }

      const { id } = req.params;
      const { additionalDays, extensionFee } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const extendAllowed = await verifyInternalStaffApplicationAccess(storage, lock.applicationId, user.id, user.role);
      if (!extendAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      // Any open lock is extendable — "extended" included, or a second
      // extension would be impossible (extensionCount exists to count them,
      // and the desk dialog offers Extend on every live lock).
      if (!OPEN_RATE_LOCK_STATUSES.includes(lock.status)) {
        return res.status(400).json({ error: "Can only extend an open rate lock" });
      }

      const currentExpiry = new Date(lock.expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + (additionalDays || 15) * 24 * 60 * 60 * 1000);

      const updated = await storage.updateRateLock(id, {
        expiresAt: newExpiry,
        extensionCount: (lock.extensionCount || 0) + 1,
        originalExpiresAt: lock.originalExpiresAt || lock.expiresAt,
        extensionFee: extensionFee?.toString(),
        status: "extended",
      });

      // Log activity
      await storage.createDealActivity({
        applicationId: lock.applicationId,
        activityType: "rate_lock_extended",
        title: "Rate Lock Extended",
        description: `Rate lock extended by ${additionalDays || 15} days`,
        performedBy: user.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Extend rate lock error:", error);
      res.status(500).json({ error: "Failed to extend rate lock" });
    }
  });

  // Cancel a rate lock
  app.post("/api/rate-locks/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      if (!isInternalStaffRole(user.role)) {
        return res.status(403).json({ error: "Internal staff only can cancel rate locks" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }

      // Verify caller is assigned to this application (assignment-scoped)
      const cancelAllowed = await verifyInternalStaffApplicationAccess(storage, lock.applicationId, user.id, user.role);
      if (!cancelAllowed) {
        return res.status(403).json({ error: "Access denied to this application" });
      }

      const updated = await storage.updateRateLock(id, {
        status: "cancelled",
        cancelledBy: user.id,
        cancelledAt: new Date(),
        cancelReason: reason,
      });

      res.json(updated);
    } catch (error) {
      console.error("Cancel rate lock error:", error);
      res.status(500).json({ error: "Failed to cancel rate lock" });
    }
  });

  // ===== ECONSENT SYSTEM =====

}
