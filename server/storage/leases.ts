import { db } from "../db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  leases,
  rentPayments,
  rentFurnishingQueue,
  type FurnishingState,
  type Lease,
  type RentPayment,
} from "@shared/schema";
import { type LeaseView, type RentPaymentView, toDateOnly } from "@shared/leaseView";
import { decryptSensitiveData, encryptSensitiveData } from "../services/encryptionService";
import { FURNISHABLE_PROVENANCE, isErasable } from "../services/rentFurnishing";
import { LeadsStorage } from "./leads";

/**
 * Lease persistence — the writer the `leases` table shipped without.
 *
 * Phase 0 landed the schema (and its encrypted-triple PII columns) ahead of any code
 * that touched them. This is that code.
 *
 * TWO THINGS THIS LAYER OWNS, so no route has to remember them:
 *   1. Encryption. Landlord email and property address go through
 *      `encryptionService` on the way in and come back out decrypted, so a caller
 *      cannot accidentally persist plaintext or leak ciphertext. The three columns
 *      (content + iv + **keyId**) always move together — keyId is what makes rotation
 *      possible, and a row missing it is unrecoverable after the next key roll.
 *   2. Ownership. Every method takes `userId` and scopes it into the SQL `WHERE`
 *      rather than reading a row and comparing afterwards. A filter that is part of
 *      the query cannot be forgotten by a caller, and there is no window where the
 *      wrong row is in memory.
 */

/** Fields a caller supplies. Dates are real `Date`s already anchored to UTC midnight. */
export interface LeaseWriteInput {
  landlordName?: string | null;
  landlordEmail?: string | null;
  propertyAddress?: string | null;
  monthlyRentAmount: string;
  leaseStartDate?: Date | null;
  leaseEndDate?: Date | null;
}

/** Encrypt one optional plaintext into its three columns. Null clears all three. */
function encryptTriple(value: string | null | undefined) {
  if (value == null || value === "") {
    return { encrypted: null, iv: null, keyId: null };
  }
  const e = encryptSensitiveData(value);
  return { encrypted: e.encryptedContent, iv: e.iv, keyId: e.keyId };
}

/**
 * Decrypt one triple back to plaintext.
 *
 * Returns null when the field was never captured. A decrypt FAILURE is different and is
 * deliberately not swallowed into null — that would silently render a lease as though the
 * landlord's email had never been entered, and the user would helpfully re-type it while
 * the real problem (a missing or rotated key) stayed invisible.
 */
function decryptTriple(
  encrypted: string | null,
  iv: string | null,
  keyId: string | null,
  field: string,
): string | null {
  if (!encrypted || !iv || !keyId) return null;
  try {
    return decryptSensitiveData(encrypted, iv, keyId);
  } catch (err) {
    throw new Error(
      `lease ${field} could not be decrypted (keyId=${keyId}) — refusing to render it as absent`,
      { cause: err },
    );
  }
}

export function toLeaseView(row: Lease): LeaseView {
  return {
    id: row.id,
    landlordName: row.landlordName ?? null,
    landlordEmail: decryptTriple(
      row.landlordEmailEncrypted,
      row.landlordEmailIv,
      row.landlordEmailKeyId,
      "landlordEmail",
    ),
    propertyAddress: decryptTriple(
      row.propertyAddressEncrypted,
      row.propertyAddressIv,
      row.propertyAddressKeyId,
      "propertyAddress",
    ),
    monthlyRentAmount: row.monthlyRentAmount,
    leaseStartDate: toDateOnly(row.leaseStartDate),
    leaseEndDate: toDateOnly(row.leaseEndDate),
    status: row.status,
    verificationStatus: row.verificationStatus,
    // Hardcoded false, not read from rent_furnishing_queue: enrolling is a separate
    // affirmative act that does not exist yet, and nothing here can furnish anything
    // while the Metro 2 authority is absent. Reading a queue row would imply otherwise.
    furnishingEnrolled: false,
  };
}

export class LeasesStorage extends LeadsStorage {
  async createLease(userId: string, input: LeaseWriteInput): Promise<Lease> {
    const email = encryptTriple(input.landlordEmail);
    const address = encryptTriple(input.propertyAddress);

    const [row] = await db
      .insert(leases)
      .values({
        userId,
        landlordName: input.landlordName ?? null,
        landlordEmailEncrypted: email.encrypted,
        landlordEmailIv: email.iv,
        landlordEmailKeyId: email.keyId,
        propertyAddressEncrypted: address.encrypted,
        propertyAddressIv: address.iv,
        propertyAddressKeyId: address.keyId,
        monthlyRentAmount: input.monthlyRentAmount,
        leaseStartDate: input.leaseStartDate ?? null,
        leaseEndDate: input.leaseEndDate ?? null,
      })
      .returning();
    return row;
  }

  async getLeasesByUser(userId: string): Promise<Lease[]> {
    return await db
      .select()
      .from(leases)
      .where(eq(leases.userId, userId))
      .orderBy(desc(leases.createdAt));
  }

  /** Owner-scoped read. Returns undefined for someone else's lease and for a missing one — */
  /** the caller cannot tell the difference, which is the point. */
  async getLeaseForUser(id: string, userId: string): Promise<Lease | undefined> {
    const [row] = await db
      .select()
      .from(leases)
      .where(and(eq(leases.id, id), eq(leases.userId, userId)))
      .limit(1);
    return row;
  }

  /**
   * Owner-scoped update. Only the fields present in `input` are written, so a partial
   * edit cannot blank the landlord email by omitting it — but an explicit `null` DOES
   * clear it, which is how a user removes a detail they no longer want stored.
   */
  async updateLeaseForUser(
    id: string,
    userId: string,
    input: Partial<LeaseWriteInput>,
  ): Promise<Lease | undefined> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if ("landlordName" in input) patch.landlordName = input.landlordName ?? null;
    if ("monthlyRentAmount" in input && input.monthlyRentAmount !== undefined) {
      patch.monthlyRentAmount = input.monthlyRentAmount;
    }
    if ("leaseStartDate" in input) patch.leaseStartDate = input.leaseStartDate ?? null;
    if ("leaseEndDate" in input) patch.leaseEndDate = input.leaseEndDate ?? null;

    if ("landlordEmail" in input) {
      const e = encryptTriple(input.landlordEmail);
      patch.landlordEmailEncrypted = e.encrypted;
      patch.landlordEmailIv = e.iv;
      patch.landlordEmailKeyId = e.keyId;
    }
    if ("propertyAddress" in input) {
      const a = encryptTriple(input.propertyAddress);
      patch.propertyAddressEncrypted = a.encrypted;
      patch.propertyAddressIv = a.iv;
      patch.propertyAddressKeyId = a.keyId;
    }

    const [row] = await db
      .update(leases)
      .set(patch)
      .where(and(eq(leases.id, id), eq(leases.userId, userId)))
      .returning();
    return row;
  }

  /**
   * Erase a lease and everything hanging off it.
   *
   * WHY A HARD DELETE. The repo's usual instinct is a soft delete — `cancelTask` is an
   * audited status flip, not a DROP. That is right for a work item, whose history is
   * the product. It is wrong here. What this row holds is a landlord's email and a
   * street address the borrower typed in, encrypted precisely because they are not ours
   * to keep; answering "delete my data" with a status flag would leave that ciphertext
   * in the table while telling the user it was gone. That is the deceptive-success
   * pattern this codebase keeps finding, aimed at a privacy promise.
   *
   * WHAT IT REFUSES. A lease whose furnishing queue has moved past `pending_authority`
   * cannot be erased — see ERASABLE_FURNISHING_STATES. Deleting the local row would
   * destroy the evidence of what was furnished while leaving the furnished data at the
   * bureau. Suppression is the remedy there, and the caller is told so by name.
   *
   * One transaction: payments and the queue row both hold an FK to `leases`, so a
   * partial delete would either fail on the constraint or orphan a history.
   */
  async deleteLeaseForUser(id: string, userId: string): Promise<LeaseDeletionResult> {
    return db.transaction(async (tx) => {
      const [lease] = await tx
        .select({ id: leases.id })
        .from(leases)
        .where(and(eq(leases.id, id), eq(leases.userId, userId)))
        .limit(1);
      if (!lease) return { ok: false, reason: "not_found" } as const;

      const [queued] = await tx
        .select({ state: rentFurnishingQueue.state })
        .from(rentFurnishingQueue)
        .where(eq(rentFurnishingQueue.leaseId, id))
        .limit(1);
      if (queued && !isErasable(queued.state as FurnishingState)) {
        return { ok: false, reason: "requires_suppression", state: queued.state } as const;
      }

      const removedPayments = await tx
        .delete(rentPayments)
        .where(eq(rentPayments.leaseId, id))
        .returning({ id: rentPayments.id });

      if (queued) {
        await tx.delete(rentFurnishingQueue).where(eq(rentFurnishingQueue.leaseId, id));
      }

      // Ownership stays in the WHERE even here, where it is already proven — the
      // predicate is what makes this statement safe to read in isolation.
      await tx.delete(leases).where(and(eq(leases.id, id), eq(leases.userId, userId)));

      return { ok: true, deletedPayments: removedPayments.length } as const;
    });
  }

  // ---------------------------------------------------------------------------
  // Rent payments
  // ---------------------------------------------------------------------------

  /**
   * List a lease's payments, owner-scoped in one query.
   *
   * `rent_payments` has no `userId` of its own — ownership runs through the lease. The
   * join puts that in the SQL rather than in a caller's memory, so there is no version
   * of this that "forgot" to check whose lease it is.
   *
   * Ordered by `dueDate` ascending: a payment history reads forwards, and the furnishing
   * queue will eventually consume it in period order.
   */
  async listRentPaymentsForUser(leaseId: string, userId: string): Promise<RentPayment[]> {
    const rows = await db
      .select({ payment: rentPayments })
      .from(rentPayments)
      .innerJoin(leases, eq(rentPayments.leaseId, leases.id))
      .where(and(eq(rentPayments.leaseId, leaseId), eq(leases.userId, userId)))
      .orderBy(asc(rentPayments.dueDate));
    return rows.map((r) => r.payment);
  }

  /**
   * Record one rent payment.
   *
   * `provenance` is NOT a parameter. It is pinned to `self_reported` at the only place
   * that inserts, because this is the borrower-entry path and a borrower's own say-so is
   * exactly what `self_reported` means. Accepting it from a caller — even an internal
   * one — would put the field that decides furnishability one careless argument away
   * from claiming first-party evidence we do not have.
   *
   * `processorReference` is likewise absent: it is the audit thread back to a payment
   * partner, and there is no partner. A synthesised value there is precisely the
   * falsified provenance CLAUDE.md forbids.
   *
   * Returns undefined when the lease is not the caller's — the insert is guarded by a
   * prior owner-scoped read rather than trusting the caller.
   */
  async recordSelfReportedRentPayment(
    leaseId: string,
    userId: string,
    input: {
      dueDate: Date;
      amountDue: string;
      paidDate?: Date | null;
      amountPaid?: string | null;
      status: string;
    },
  ): Promise<RentPayment | undefined> {
    const lease = await this.getLeaseForUser(leaseId, userId);
    if (!lease) return undefined;

    const [row] = await db
      .insert(rentPayments)
      .values({
        leaseId,
        dueDate: input.dueDate,
        paidDate: input.paidDate ?? null,
        amountDue: input.amountDue,
        amountPaid: input.amountPaid ?? null,
        status: input.status,
        provenance: "self_reported",
        processorReference: null,
      })
      .returning();
    return row;
  }
}

/**
 * Why a lease could not be erased. `furnished` is the interesting one: it means the
 * line has left the building and the honest remedy is suppression, not deletion.
 */
export type LeaseDeletionResult =
  | { ok: true; deletedPayments: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "requires_suppression"; state: string };

/**
 * Map a payment row to its borrower-facing view.
 *
 * `furnishable` is derived from the SAME constant the furnishing gate reads, not
 * re-stated here — so a surface can never claim a row is reportable when the gate
 * would refuse it, and widening the gate updates both at once.
 */
export function toRentPaymentView(row: RentPayment): RentPaymentView {
  return {
    id: row.id,
    leaseId: row.leaseId,
    dueDate: toDateOnly(row.dueDate) as string,
    paidDate: toDateOnly(row.paidDate),
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    status: row.status,
    provenance: row.provenance,
    furnishable: FURNISHABLE_PROVENANCE.includes(row.provenance as never),
  };
}
