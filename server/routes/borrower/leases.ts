import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../../auth";
import type { IStorage } from "../../storage";
import { toLeaseView, toRentPaymentView } from "../../storage/leases";
import { logAudit } from "../../auditLog";
import { routeParam } from "../../http/routeParams";
import { type User } from "@shared/schema";
import { fromDateOnly } from "@shared/leaseView";

/**
 * Lease capture — the authenticated writer for the `leases` table.
 *
 * Phase 0 shipped the schema and the furnishing gate but no way to enter a lease, so the
 * encrypted PII columns had a reader and no writer. This closes that.
 *
 * WHAT THIS DOES NOT DO. Creating a lease does not enrol anyone in credit-bureau
 * furnishing. Enrolment is a separate affirmative act (a `rent_furnishing_queue` row
 * with `consumer_authorized_at`), and it is deliberately absent: nothing in this repo can
 * furnish anything while the Metro 2 and FCRA authorities are missing, so an enrolment
 * control here would be a switch wired to nothing that a user would reasonably read as
 * "my rent is now being reported".
 *
 * DATES ARE DATE-ONLY, IN UTC. A lease starts on a calendar day, not at an instant.
 * `YYYY-MM-DD` in and out, parsed to UTC midnight, formatted with UTC getters. The
 * failure mode this avoids is live in this codebase: `monthlyIncomeFromYtd` parsed a
 * date-only string and read it with local `getMonth()`/`getDate()`, which shifted the
 * period back a day west of Greenwich and *overstated* borrower income — invisible in CI
 * because runners are UTC.
 */

/** `YYYY-MM-DD` → UTC-midnight Date. Rejects anything that is not a real calendar day. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => {
    const d = fromDateOnly(s);
    // Round-trip guard: "2026-02-31" parses to March 3 rather than failing, so compare
    // the parsed instant back to the input instead of trusting the regex alone.
    return d !== null && d.toISOString().slice(0, 10) === s;
  }, "not a real calendar date")
  .transform((s) => fromDateOnly(s) as Date);

/**
 * Monthly rent as a decimal string.
 *
 * Kept as a STRING end to end — `monthly_rent_amount` is `numeric(10,2)`, and routing a
 * currency amount through a JS float is how a cent goes missing. Bounded above by the
 * column's own precision: numeric(10,2) holds at most 99,999,999.99, and a value that
 * overflows would throw at the database rather than at validation.
 */
const rentAmount = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), "must be a positive amount with at most 2 decimals")
  .refine((v) => Number(v) > 0, "must be greater than zero");

/** The shared field set. Kept as a bare object so both schemas below can build on it — */
/** zod v4 dropped `.innerType()`, so a refined schema can no longer be re-opened. */
const leaseFields = {
  landlordName: z.string().trim().max(255).optional(),
  landlordEmail: z.string().trim().email().max(255).optional(),
  propertyAddress: z.string().trim().min(1).max(500).optional(),
  monthlyRentAmount: rentAmount,
  leaseStartDate: dateOnly.optional(),
  leaseEndDate: dateOnly.optional(),
};

const endNotBeforeStart = (d: { leaseStartDate?: Date | null; leaseEndDate?: Date | null }) =>
  !d.leaseStartDate || !d.leaseEndDate || d.leaseEndDate >= d.leaseStartDate;

/** Exported for tests — validation this specific is worth pinning directly. */
export const leaseBodySchema = z
  .object(leaseFields)
  .refine(endNotBeforeStart, {
    message: "lease end date cannot precede the start date",
    path: ["leaseEndDate"],
  });

/**
 * Every field optional on update, but an empty body is a no-op and rejected as one.
 *
 * `null` explicitly CLEARS a stored detail — that is how a user removes their landlord's
 * email. `undefined` (absent) leaves it untouched. The storage layer distinguishes the
 * two by key presence, so the two spellings must stay distinguishable here too.
 */
export const leasePatchSchema = z
  .object({
    ...leaseFields,
    landlordName: z.string().trim().max(255).nullable().optional(),
    landlordEmail: z.string().trim().email().max(255).nullable().optional(),
    propertyAddress: z.string().trim().min(1).max(500).nullable().optional(),
    monthlyRentAmount: rentAmount.optional(),
    leaseStartDate: dateOnly.nullable().optional(),
    leaseEndDate: dateOnly.nullable().optional(),
  })
  .refine(endNotBeforeStart, {
    message: "lease end date cannot precede the start date",
    path: ["leaseEndDate"],
  });

/**
 * A recorded rent payment.
 *
 * Note what is NOT here: `provenance` and `processorReference`. Both are set by the
 * storage layer, because both are claims about *evidence* rather than about the
 * payment, and a request must never be able to assert first-party evidence.
 *
 * `status` is constrained to the settled outcomes a borrower can honestly report about
 * a period. `scheduled` is excluded — recording a payment that has not happened yet is
 * a different feature (a schedule), and letting it in here would put unsettled rows in
 * the same history a furnishing run reads.
 */
export const rentPaymentBodySchema = z
  .object({
    dueDate: dateOnly,
    amountDue: rentAmount,
    paidDate: dateOnly.nullable().optional(),
    amountPaid: rentAmount.nullable().optional(),
    status: z.enum(["paid", "late", "missed"]),
  })
  .refine((d) => d.status === "missed" || d.paidDate != null, {
    message: "a paid or late payment needs the date it was paid",
    path: ["paidDate"],
  })
  .refine((d) => d.status === "missed" || d.amountPaid != null, {
    message: "a paid or late payment needs the amount paid",
    path: ["amountPaid"],
  })
  .refine((d) => !d.paidDate || d.paidDate >= d.dueDate || d.status !== "late", {
    message: "a payment made on or before its due date is not late",
    path: ["status"],
  });

export function registerLeaseRoutes(app: Express, storage: IStorage) {
  app.get("/api/leases", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const rows = await storage.getLeasesByUser(user.id);
      res.json({ leases: rows.map(toLeaseView) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/leases", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const parsed = leaseBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid lease",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const lease = await storage.createLease(user.id, parsed.data);

      // Field NAMES only — never a landlord email or a street address, which are the
      // two things on this row worth encrypting in the first place.
      await logAudit(req, "lease.created", "lease", lease.id, {
        hasLandlordEmail: Boolean(parsed.data.landlordEmail),
        hasPropertyAddress: Boolean(parsed.data.propertyAddress),
      });

      res.status(201).json({ lease: toLeaseView(lease) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/leases/:id", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const lease = await storage.getLeaseForUser(routeParam(req, "id"), user.id);
      // 404, not 403: a 403 would confirm the id exists and belongs to someone else.
      if (!lease) return res.status(404).json({ error: "Lease not found" });
      res.json({ lease: toLeaseView(lease) });
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/leases/:id", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const parsed = leasePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid lease",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      if (Object.keys(parsed.data).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }
      if (
        parsed.data.leaseStartDate &&
        parsed.data.leaseEndDate &&
        parsed.data.leaseEndDate < parsed.data.leaseStartDate
      ) {
        return res.status(400).json({ error: "lease end date cannot precede the start date" });
      }

      const updated = await storage.updateLeaseForUser(routeParam(req, "id"), user.id, parsed.data);
      if (!updated) return res.status(404).json({ error: "Lease not found" });

      await logAudit(req, "lease.updated", "lease", updated.id, {
        fields: Object.keys(parsed.data),
      });

      res.json({ lease: toLeaseView(updated) });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Erase a lease and its payment history.
   *
   * A hard delete, deliberately — see the storage method for why a status flag would be
   * a lie here. Refuses with 409 when the lease has been furnished, naming suppression
   * as the remedy rather than silently doing something adjacent.
   */
  app.delete("/api/leases/:id", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const leaseId = routeParam(req, "id");
      const result = await storage.deleteLeaseForUser(leaseId, user.id);

      if (!result.ok && result.reason === "not_found") {
        return res.status(404).json({ error: "Lease not found" });
      }
      if (!result.ok) {
        return res.status(409).json({
          error:
            "This lease has been reported to a credit bureau and cannot be deleted. " +
            "It has to be suppressed instead, so the record of what was reported survives.",
          state: result.state,
        });
      }

      // Counts and ids only. The whole point of the request was to remove the landlord
      // email and the address; writing either into an audit row would defeat it.
      await logAudit(req, "lease.deleted", "lease", leaseId, {
        deletedPayments: result.deletedPayments,
      });

      res.json({ deleted: true, deletedPayments: result.deletedPayments });
    } catch (err) {
      next(err);
    }
  });

  // ---------------------------------------------------------------------------
  // Rent payments
  //
  // The borrower-entry path, and the ONLY producer of rent_payments rows today.
  // Everything it writes is `self_reported` and therefore permanently outside
  // FURNISHABLE_PROVENANCE — useful for the borrower's own history, never eligible to
  // reach a bureau. `provenance` and `processorReference` are absent from the schema
  // below on purpose: a request must not be able to assert first-party evidence.
  // ---------------------------------------------------------------------------

  app.get("/api/leases/:id/payments", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const leaseId = routeParam(req, "id");
      // Resolve the lease first so an unknown id and a foreign one answer identically.
      const lease = await storage.getLeaseForUser(leaseId, user.id);
      if (!lease) return res.status(404).json({ error: "Lease not found" });

      const rows = await storage.listRentPaymentsForUser(leaseId, user.id);
      res.json({ payments: rows.map(toRentPaymentView) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/leases/:id/payments", isAuthenticated, async (req, res, next) => {
    try {
      const user = req.user as User;
      const parsed = rentPaymentBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid payment",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const payment = await storage.recordSelfReportedRentPayment(
        routeParam(req, "id"),
        user.id,
        parsed.data,
      );
      if (!payment) return res.status(404).json({ error: "Lease not found" });

      await logAudit(req, "rent_payment.recorded", "rent_payment", payment.id, {
        leaseId: payment.leaseId,
        status: payment.status,
        provenance: payment.provenance,
      });

      res.status(201).json({ payment: toRentPaymentView(payment) });
    } catch (err: unknown) {
      // The (lease_id, due_date) unique index is the guard against double-counting a
      // month into a history that a furnishing run would eventually read. Answer 409
      // rather than letting a constraint violation surface as a 500.
      if ((err as { code?: string })?.code === "23505") {
        return res.status(409).json({ error: "A payment for that period already exists" });
      }
      next(err);
    }
  });
}
