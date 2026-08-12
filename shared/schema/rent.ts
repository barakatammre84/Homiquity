import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./core";

// =============================================================================
// Rent ledger — leases, rent payments, and the bureau-furnishing queue.
//
// WHY THIS EXISTS. Before this module the only borrower-paid rent in the repo was
// `homeownership_goals.current_rent`: a single self-entered decimal, consumed as a
// tier-3 DTI *liability* in server/services/borrowerGraph.ts — a debt, not a credit
// positive. This module makes rent a first-class record with provenance, which is the
// precondition for it ever being treated as anything else.
//
// WHAT IT DELIBERATELY IS NOT. Nothing here transmits anything to a credit bureau.
// docs/cdia-metro2/ and docs/fcra/ are README-only, so both the format authority (the
// CDIA Metro 2 manual) and the furnishing authority (FCRA §1681s-2, Reg V Appendix E)
// are absent. The queue accumulates state and performs no I/O. See those READMEs for
// the acquisition path, and data/regulatory/regulatory-ledger.json for the four flagged
// entries this module is bound by.
// =============================================================================

/**
 * How we know a rent payment happened. This is the axis that decides furnishability,
 * so it is a provenance column in the CLAUDE.md sense: it is never backfilled with a
 * guessed value, because the value's whole job is to say how much the record can be
 * trusted. A NULL-ish gap is honest; a wrong value here becomes a falsified statement
 * about a consumer on a third party's credit file.
 *
 * - `platform_processed` — rent moved through the platform's payment partner. First-party
 *   evidence. The ONLY value eligible to be furnished (ledger: fcra-1681s2-furnisher-accuracy).
 * - `bank_observed`      — inferred from bank transaction data. NOT furnishable: an inferred
 *   payment cannot be defended under an accuracy duty we have not yet read.
 * - `self_reported`      — the renter told us. Useful for their own planning surfaces; never
 *   furnished, never treated as verified.
 */
export const RENT_PAYMENT_PROVENANCE = ["self_reported", "platform_processed", "bank_observed"] as const;
export type RentPaymentProvenance = (typeof RENT_PAYMENT_PROVENANCE)[number];

/** Lifecycle of a scheduled rent obligation. Kept strictly separate from provenance. */
export const RENT_PAYMENT_STATUS = ["scheduled", "paid", "late", "missed", "waived"] as const;
export type RentPaymentStatus = (typeof RENT_PAYMENT_STATUS)[number];

/** Lease lifecycle. Kept strictly separate from `verificationStatus` — see the note below. */
export const LEASE_STATUS = ["active", "ended", "cancelled"] as const;
export type LeaseStatus = (typeof LEASE_STATUS)[number];

/** What we have actually confirmed about a lease, as opposed to where it is in its life. */
export const LEASE_VERIFICATION_STATUS = [
  "unverified",
  "landlord_confirmed",
  "document_verified",
  "rejected",
] as const;
export type LeaseVerificationStatus = (typeof LEASE_VERIFICATION_STATUS)[number];

/**
 * Furnishing queue states.
 *
 * `pending_authority` is the entry state and the current terminus for everything: it means
 * the authority documents do not exist locally, so no record may leave the building. It is
 * not a placeholder to be optimised away — it is the state the whole program sits in until
 * a human completes CDIA furnisher onboarding.
 */
export const FURNISHING_STATE = [
  "pending_authority",
  "pending_minimum_lines",
  "queued",
  "furnished",
  "disputed",
  "suppressed",
] as const;
export type FurnishingState = (typeof FURNISHING_STATE)[number];

// -----------------------------------------------------------------------------
// Leases
// -----------------------------------------------------------------------------

/**
 * A renter's lease. Two-axis status by design (the tasks-status-vocab lesson): `status`
 * carries the lifecycle, `verificationStatus` carries the verdict. Collapsing the two into
 * one column is what made an SLA sweep miss 1,015 task rows — the same mistake here would
 * mean "we could not verify this lease" and "this lease ended" become indistinguishable,
 * on records that decide what gets said about someone's credit.
 */
export const leases = pgTable(
  "leases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),

    // Landlord name is a business counterparty (frequently a management company) and is
    // stored in the clear so staff can reconcile a payment without a decrypt. The email
    // and the street address are third-party / location PII and are encrypted at rest on
    // the three-column pattern (encryptionService: content + iv + keyId — keyId is what
    // makes rotation possible, so never store only two of the three).
    landlordName: varchar("landlord_name", { length: 255 }),
    landlordEmailEncrypted: text("landlord_email_encrypted"),
    landlordEmailIv: varchar("landlord_email_iv", { length: 32 }),
    landlordEmailKeyId: varchar("landlord_email_key_id", { length: 20 }),
    propertyAddressEncrypted: text("property_address_encrypted"),
    propertyAddressIv: varchar("property_address_iv", { length: 32 }),
    propertyAddressKeyId: varchar("property_address_key_id", { length: 20 }),

    monthlyRentAmount: decimal("monthly_rent_amount", { precision: 10, scale: 2 }).notNull(),
    leaseStartDate: timestamp("lease_start_date"),
    leaseEndDate: timestamp("lease_end_date"),

    status: varchar("status", { length: 32 }).notNull().default("active"),
    verificationStatus: varchar("verification_status", { length: 32 }).notNull().default("unverified"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_leases_user").on(table.userId),
    index("idx_leases_status").on(table.status),
  ],
);

// -----------------------------------------------------------------------------
// Rent payments
// -----------------------------------------------------------------------------

/**
 * One row per rent period. `status` is the lifecycle; `provenance` is the evidentiary
 * basis. Both are required, and the pair is what the furnishing gate reads — a `paid`
 * row with `bank_observed` provenance is real enough to show the renter and not real
 * enough to send to a bureau.
 */
export const rentPayments = pgTable(
  "rent_payments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    leaseId: varchar("lease_id").references(() => leases.id).notNull(),

    dueDate: timestamp("due_date").notNull(),
    paidDate: timestamp("paid_date"),
    amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull(),
    amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),

    status: varchar("status", { length: 32 }).notNull().default("scheduled"),
    provenance: varchar("provenance", { length: 32 }).notNull(),

    // Set only for provenance='platform_processed': the payment partner's own identifier
    // for the transfer. This is the audit thread back to a first-party record, and it is
    // what makes a furnished row defensible. Never synthesised.
    processorReference: varchar("processor_reference", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_rent_payments_lease").on(table.leaseId),
    index("idx_rent_payments_status").on(table.status),
    // One row per lease per period — re-running an importer must not double-count a month
    // into a payment history that will eventually be furnished.
    uniqueIndex("idx_rent_payments_lease_due").on(table.leaseId, table.dueDate),
  ],
);

// -----------------------------------------------------------------------------
// Furnishing queue
// -----------------------------------------------------------------------------

/**
 * One row per lease that a consumer has asked us to report. Separate from `leases` because
 * the two lifecycles are genuinely independent: a lease can end while its tradeline is
 * still under dispute, and a consumer can withdraw reporting without ending their lease.
 */
export const rentFurnishingQueue = pgTable(
  "rent_furnishing_queue",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    leaseId: varchar("lease_id").references(() => leases.id).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),

    state: varchar("state", { length: 32 }).notNull().default("pending_authority"),
    stateReason: text("state_reason"),
    enteredStateAt: timestamp("entered_state_at").defaultNow().notNull(),

    // The consumer's affirmative authorisation to furnish. The queue service refuses to
    // advance a row without it; there is no default and no backfill.
    consumerAuthorizedAt: timestamp("consumer_authorized_at"),

    furnishedAt: timestamp("furnished_at"),
    suppressedAt: timestamp("suppressed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_rent_furnishing_lease").on(table.leaseId),
    index("idx_rent_furnishing_state").on(table.state),
    index("idx_rent_furnishing_user").on(table.userId),
  ],
);

// -----------------------------------------------------------------------------
// Insert schemas + types
// -----------------------------------------------------------------------------

export const insertLeaseSchema = createInsertSchema(leases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Lease = typeof leases.$inferSelect;

export const insertRentPaymentSchema = createInsertSchema(rentPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentPayment = z.infer<typeof insertRentPaymentSchema>;
export type RentPayment = typeof rentPayments.$inferSelect;

export const insertRentFurnishingQueueSchema = createInsertSchema(rentFurnishingQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRentFurnishingQueue = z.infer<typeof insertRentFurnishingQueueSchema>;
export type RentFurnishingQueueRow = typeof rentFurnishingQueue.$inferSelect;
