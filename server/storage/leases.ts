import { db } from "../db";
import { and, desc, eq } from "drizzle-orm";
import { leases, type Lease } from "@shared/schema";
import { type LeaseView, toDateOnly } from "@shared/leaseView";
import { decryptSensitiveData, encryptSensitiveData } from "../services/encryptionService";
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
}
