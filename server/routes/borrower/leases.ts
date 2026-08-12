import type { Express } from "express";
import { z } from "zod";
import { isAuthenticated } from "../../auth";
import type { IStorage } from "../../storage";
import { toLeaseView } from "../../storage/leases";
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
}
