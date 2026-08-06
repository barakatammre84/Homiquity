// Borrower routes: Rate locks: create/list/expiring/extend/cancel.
// One registrar in the original registration order — see ./index.ts.
import type { Express } from "express";
import { isAdmin } from "@shared/roles";
import { type IStorage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { EXTENSION_FEE_PAYERS, isInternalStaffRole, OPEN_RATE_LOCK_STATUSES, type User } from "@shared/schema";
import {
  isLenderConfirmed,
  rateLockDescription,
  rateLockKind,
  rateLockNoun,
} from "@shared/rateLockConfirmation";
import { z } from "zod";
import { firstQueryValue } from "../queryParams";

// Verify that an internal staff user is actually assigned to the given application.
// Returns true for admin (unrestricted), checks LO assignment for lo/loa, and
// deal-team membership for processor/underwriter/closer.
// External partner roles (broker, lender) are NOT permitted by this helper.
// Exported: the LO-2 scenario route reuses this gate (one access model, no forks).
import { verifyInternalStaffApplicationAccess } from "./access";
import { routeParams } from "../../http/routeParams";

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

      // A lock is a LENDER commitment. The broker records one it obtained;
      // it cannot manufacture one (F-3). Every confirmation field is required
      // — partial evidence cannot tell a borrower when their rate expires.
      const schema = z.object({
        applicationId: z.string(),
        loanOptionId: z.string(),
        lockPeriodDays: z.number().min(15).max(90).default(30),
        notes: z.string().optional(),
        lenderId: z.string().min(1),
        lockConfirmationNumber: z.string().min(1).max(60),
        confirmedRate: z.number().positive().max(99),
        confirmedExpiresAt: z.coerce.date(),
      });

      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid input", details: result.error.format() });
      }

      const {
        applicationId, loanOptionId, lockPeriodDays, notes,
        lenderId, lockConfirmationNumber, confirmedRate, confirmedExpiresAt,
      } = result.data;

      // The lender must be one we actually have a relationship with. An
      // unknown id means the confirmation came from somewhere unaccountable.
      const lender = await storage.getWholesaleLenderByLenderId(lenderId);
      if (!lender) {
        return res.status(400).json({
          error: `Unknown wholesale lender "${lenderId}"`,
          code: "unknown_lender",
        });
      }
      if (confirmedExpiresAt.getTime() <= Date.now()) {
        return res.status(400).json({
          error: "The lender-confirmed expiration is already in the past",
          code: "confirmation_expired",
        });
      }

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

      // The lender's confirmed expiration is authoritative — local
      // lockPeriodDays math describes what we ASKED for, never what we got.
      const expiresAt = confirmedExpiresAt;

      const rateLock = await storage.createRateLock({
        applicationId,
        loanOptionId,
        // The rate on the lock is the rate the LENDER confirmed. It may differ
        // from the quoted option; storing the quote here would put a number on
        // the borrower's lock that nobody committed to.
        interestRate: confirmedRate.toString(),
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
        lenderId,
        lockConfirmationNumber,
        confirmedRate: confirmedRate.toString(),
        confirmedExpiresAt,
        confirmedBy: user.id,
        confirmedAt: new Date(),
        // No lender is credentialed yet, so every confirmation today is keyed
        // in by staff off a portal or a phone call rather than returned by an
        // API. Mark it, the way lender_submissions does.
        simulated: lender.approvalStatus !== "approved",
      });

      // Also update the loan option
      await storage.lockLoanOption(loanOptionId);

      const quotedRate = Number(loanOption.interestRate);
      const rateDrift = Number.isFinite(quotedRate) && Math.abs(quotedRate - confirmedRate) > 0.0001;

      // Log activity
      await storage.createDealActivity({
        applicationId,
        activityType: "rate_locked",
        title: "Rate Locked",
        description: rateLockDescription(rateLock, confirmedRate, lockPeriodDays),
        metadata: {
          rateLockId: rateLock.id,
          lenderId,
          lockConfirmationNumber,
          quotedRate: loanOption.interestRate,
          confirmedRate,
          // A lender confirming a different rate than we quoted is a
          // redisclosure trigger, not a rounding detail.
          rateDriftFromQuote: rateDrift,
        },
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
      const { applicationId } = routeParams(req);
      const application = await storage.getLoanApplicationWithAccess(applicationId, user.id, user.role);
      if (!application) {
        return res.status(403).json({ error: "Access denied" });
      }
      const locks = await storage.getRateLocksByApplication(applicationId);
      // Annotate rather than filter: a borrower is entitled to see the record,
      // but it must not be presented as a commitment if no lender made one.
      res.json(locks.map(lock => ({
        ...lock,
        kind: rateLockKind(lock),
        lenderConfirmed: isLenderConfirmed(lock),
        label: rateLockNoun(lock),
      })));
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
      if (isAdmin(user)) {
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

      const { id } = routeParams(req);

      // Previously this took `additionalDays` and `extensionFee` straight off
      // req.body with no validation, and extended the expiry by local math —
      // producing a longer commitment nobody had granted. Only the lender can
      // extend a lock, so an extension needs its own confirmation.
      //
      // The fee also needs a PAYER (F-10). An amount with no payer cannot
      // distinguish a cost we absorbed from a charge we passed through, and
      // passing one to the borrower without a changed-circumstance record is a
      // tolerance violation — so a borrower-paid fee must cite one.
      const extendSchema = z
        .object({
          additionalDays: z.number().int().min(1).max(90),
          extensionFee: z.number().min(0).optional(),
          extensionFeePaidBy: z.enum(EXTENSION_FEE_PAYERS).optional(),
          extensionFeeCocId: z.string().min(1).optional(),
          lockConfirmationNumber: z.string().min(1).max(60),
          confirmedExpiresAt: z.coerce.date(),
        })
        .refine(v => !(v.extensionFee && v.extensionFee > 0) || !!v.extensionFeePaidBy, {
          message: "extensionFeePaidBy is required when an extension fee is charged",
          path: ["extensionFeePaidBy"],
        })
        .refine(v => v.extensionFeePaidBy !== "borrower" || !!v.extensionFeeCocId, {
          message:
            "A borrower-paid extension fee increases a disclosed charge, so it requires a " +
            "change-of-circumstance record (12 CFR 1026.19(e)(3)(iv)).",
          path: ["extensionFeeCocId"],
        });
      const extendResult = extendSchema.safeParse(req.body);
      if (!extendResult.success) {
        return res.status(400).json({ error: "Invalid input", details: extendResult.error.format() });
      }
      const {
        additionalDays, extensionFee, extensionFeePaidBy, extensionFeeCocId,
        lockConfirmationNumber, confirmedExpiresAt,
      } = extendResult.data;

      const lock = await storage.getRateLock(id);
      if (!lock) {
        return res.status(404).json({ error: "Rate lock not found" });
      }
      // An unconfirmed row was never a lock; there is nothing to extend.
      if (!isLenderConfirmed(lock)) {
        return res.status(409).json({
          error:
            "This record has no lender confirmation, so it is an indicative quote rather than a lock. " +
            "Obtain a lender lock confirmation and record it as a new lock instead of extending.",
          code: "lock_not_confirmed",
        });
      }
      if (confirmedExpiresAt.getTime() <= new Date(lock.expiresAt).getTime()) {
        return res.status(400).json({
          error: "The extended expiration must be later than the current one",
          code: "extension_not_forward",
        });
      }

      // A cited change of circumstance must actually exist, belong to this
      // file, and not be voided — otherwise the citation is decoration.
      if (extensionFeeCocId) {
        const coc = await storage.getChangeOfCircumstance(extensionFeeCocId);
        if (!coc || coc.applicationId !== lock.applicationId) {
          return res.status(400).json({
            error: "The cited change-of-circumstance record does not exist on this application",
            code: "coc_not_found",
          });
        }
        if (coc.status === "voided") {
          return res.status(400).json({
            error: "The cited change-of-circumstance record has been voided and cannot justify a charge",
            code: "coc_voided",
          });
        }
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

      // The lender's confirmed expiration is authoritative — not
      // currentExpiry + additionalDays.
      const updated = await storage.updateRateLock(id, {
        expiresAt: confirmedExpiresAt,
        confirmedExpiresAt,
        lockConfirmationNumber,
        confirmedBy: user.id,
        confirmedAt: new Date(),
        extensionCount: (lock.extensionCount || 0) + 1,
        originalExpiresAt: lock.originalExpiresAt || lock.expiresAt,
        extensionFee: extensionFee?.toString(),
        extensionFeePaidBy: extensionFeePaidBy ?? null,
        extensionFeeCocId: extensionFeeCocId ?? null,
        status: "extended",
      });

      // A broker-paid extension fee is a real cost against this file — book it
      // where costs live (F-11) so it reaches the margin figures instead of
      // sitting inert on the lock row. Borrower- and lender-paid fees are not
      // our cost and are deliberately not booked. Non-fatal.
      if (extensionFee && extensionFee > 0 && extensionFeePaidBy === "broker") {
        try {
          await storage.createLoanCostEntry({
            applicationId: lock.applicationId,
            category: "rate_lock_extension",
            vendor: lock.lenderId
              ? (await storage.getWholesaleLenderByLenderId(lock.lenderId))?.lenderName ?? lock.lenderId
              : null,
            amount: extensionFee.toFixed(2),
            incurredAt: new Date(),
            automatic: true,
            simulated: false,
            description: `Rate-lock extension (${additionalDays} days, confirmation ${lockConfirmationNumber})`,
            recordedBy: user.id,
          });
        } catch (err) {
          console.warn("[rateLocks] extension-fee cost entry failed (non-fatal):", err);
        }
      }

      // Log activity
      await storage.createDealActivity({
        applicationId: lock.applicationId,
        activityType: "rate_lock_extended",
        title: "Rate Lock Extended",
        description:
          `Rate lock extended by ${additionalDays} days to ${confirmedExpiresAt.toISOString().split("T")[0]}, ` +
          `confirmed by the lender (${lockConfirmationNumber}).` +
          (extensionFee && extensionFee > 0
            ? ` Extension fee $${extensionFee.toFixed(2)} paid by ${extensionFeePaidBy}.`
            : " No extension fee."),
        metadata: {
          rateLockId: id,
          lockConfirmationNumber,
          confirmedExpiresAt: confirmedExpiresAt.toISOString(),
          extensionFee: extensionFee ?? null,
          extensionFeePaidBy: extensionFeePaidBy ?? null,
          extensionFeeCocId: extensionFeeCocId ?? null,
        },
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

      const { id } = routeParams(req);
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
