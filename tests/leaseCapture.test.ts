import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { toDateOnly, fromDateOnly, type LeaseView } from "../shared/leaseView";
import {
  encryptSensitiveData,
  __resetEncryptionStateForTests,
} from "../server/services/encryptionService";
import { toLeaseView } from "../server/storage/leases";
import { leaseBodySchema, leasePatchSchema } from "../server/routes/borrower/leases";
import type { Lease } from "../shared/schema";

/**
 * Lease capture — the writer the `leases` table shipped without.
 *
 * Pure in-process: no HTTP server, no database. The storage layer's SQL is not exercised
 * here; what IS exercised is everything that decides whether a lease is stored and
 * rendered correctly — the encryption round-trip, the view's refusal to leak ciphertext,
 * UTC date semantics, and the validation boundary.
 */

const ROOT = path.resolve(__dirname, "..");
const KEY = crypto.randomBytes(32).toString("base64");
let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.CREDIT_ENCRYPTION_KEY;
  process.env.CREDIT_ENCRYPTION_KEY = KEY;
  __resetEncryptionStateForTests();
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.CREDIT_ENCRYPTION_KEY;
  else process.env.CREDIT_ENCRYPTION_KEY = savedKey;
  __resetEncryptionStateForTests();
});

// -----------------------------------------------------------------------------
// Dates
// -----------------------------------------------------------------------------

describe("date-only handling is UTC, end to end", () => {
  it("parses YYYY-MM-DD to exactly UTC midnight", () => {
    expect(fromDateOnly("2026-06-30")?.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    expect(fromDateOnly("2026-01-01")?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(fromDateOnly("2026-12-31")?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });

  it("round-trips every boundary date unchanged", () => {
    // Month ends, year ends, and a leap day — the days a local-vs-UTC slip moves first.
    for (const s of ["2026-01-31", "2026-02-28", "2024-02-29", "2026-06-30", "2026-07-01", "2026-12-31"]) {
      expect(toDateOnly(fromDateOnly(s)), s).toBe(s);
    }
  });

  it("formats an end-of-day UTC instant as the same calendar day", () => {
    // 23:59:59Z is the crossing that a local read moves to the NEXT day east of
    // Greenwich and keeps on the previous one west of it.
    expect(toDateOnly(new Date("2026-06-30T23:59:59.000Z"))).toBe("2026-06-30");
    expect(toDateOnly(new Date("2026-06-30T00:00:00.000Z"))).toBe("2026-06-30");
  });

  it("returns null rather than an Invalid Date a caller could persist as NaN", () => {
    expect(fromDateOnly("")).toBeNull();
    expect(fromDateOnly(null)).toBeNull();
    expect(fromDateOnly("30-06-2026")).toBeNull();
    expect(fromDateOnly("2026-6-30")).toBeNull();
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(new Date("nonsense"))).toBeNull();
  });

  // THE REGRESSION GUARD. `monthlyIncomeFromYtd` parsed a date-only string and read it
  // with local getMonth()/getDate(); west of Greenwich that shortened the elapsed period
  // and OVERSTATED borrower income, and it was invisible in CI because runners are UTC.
  // Lease start/end dates are the same shape, so pin the module against local getters.
  it("shared/leaseView.ts uses no local date getters", () => {
    const src = fs.readFileSync(path.join(ROOT, "shared/leaseView.ts"), "utf8");
    expect(src, "local getter found — use the getUTC* form").not.toMatch(
      /\.get(FullYear|Month|Date|Day|Hours|Minutes)\s*\(/,
    );
    expect(src).toMatch(/getUTCFullYear|getUTCMonth|getUTCDate/);
  });
});

// -----------------------------------------------------------------------------
// The view
// -----------------------------------------------------------------------------

function rowWith(over: Partial<Lease> = {}): Lease {
  const now = new Date("2026-08-01T00:00:00.000Z");
  return {
    id: "lease-1",
    userId: "user-1",
    landlordName: "Acme Property Group",
    landlordEmailEncrypted: null,
    landlordEmailIv: null,
    landlordEmailKeyId: null,
    propertyAddressEncrypted: null,
    propertyAddressIv: null,
    propertyAddressKeyId: null,
    monthlyRentAmount: "1450.00",
    leaseStartDate: new Date("2026-06-30T00:00:00.000Z"),
    leaseEndDate: new Date("2027-06-29T00:00:00.000Z"),
    status: "active",
    verificationStatus: "unverified",
    createdAt: now,
    updatedAt: now,
    ...over,
  } as Lease;
}

/** Encrypt a value into the three columns for a given field prefix. */
function encTriple(value: string) {
  const e = encryptSensitiveData(value);
  return { encrypted: e.encryptedContent, iv: e.iv, keyId: e.keyId };
}

describe("toLeaseView", () => {
  it("decrypts the PII fields back to plaintext", () => {
    const email = encTriple("leasing@acme.com");
    const address = encTriple("123 Main St, Chicago, IL 60601");
    const view = toLeaseView(
      rowWith({
        landlordEmailEncrypted: email.encrypted,
        landlordEmailIv: email.iv,
        landlordEmailKeyId: email.keyId,
        propertyAddressEncrypted: address.encrypted,
        propertyAddressIv: address.iv,
        propertyAddressKeyId: address.keyId,
      }),
    );
    expect(view.landlordEmail).toBe("leasing@acme.com");
    expect(view.propertyAddress).toBe("123 Main St, Chicago, IL 60601");
  });

  it("never emits ciphertext, IVs, or key ids", () => {
    const email = encTriple("leasing@acme.com");
    const view = toLeaseView(
      rowWith({
        landlordEmailEncrypted: email.encrypted,
        landlordEmailIv: email.iv,
        landlordEmailKeyId: email.keyId,
      }) ,
    );
    const keys = Object.keys(view);
    expect(keys.some((k) => /Encrypted$|Iv$|KeyId$/.test(k))).toBe(false);
    // Nor by value — a rename could reintroduce it under an innocent-looking key.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(email.encrypted);
    expect(serialized).not.toContain(email.iv);
    // userId is not the client's business either.
    expect(keys).not.toContain("userId");
  });

  it("renders an uncaptured field as null, not an empty string", () => {
    const view = toLeaseView(rowWith());
    expect(view.landlordEmail).toBeNull();
    expect(view.propertyAddress).toBeNull();
  });

  it("THROWS on an undecryptable field rather than rendering it as absent", () => {
    // Rendering a decrypt failure as null would show the user a lease with no landlord
    // email; they would helpfully re-type it while the real fault (a missing or rotated
    // key) stayed invisible. Loud beats tidy.
    const view = () =>
      toLeaseView(
        rowWith({
          landlordEmailEncrypted: "not-real-ciphertext",
          landlordEmailIv: "AAAAAAAAAAAAAAAAAAAAAA==",
          landlordEmailKeyId: "v1",
        }),
      );
    expect(view).toThrow(/could not be decrypted/);
  });

  it("emits date-only strings, not ISO instants", () => {
    const view = toLeaseView(rowWith());
    expect(view.leaseStartDate).toBe("2026-06-30");
    expect(view.leaseEndDate).toBe("2027-06-29");
  });

  it("reports furnishing as off — nothing can furnish while the authority is absent", () => {
    const view: LeaseView = toLeaseView(rowWith());
    expect(view.furnishingEnrolled).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

describe("leaseBodySchema", () => {
  const ok = { monthlyRentAmount: "1450.00" };

  it("accepts a minimal lease — only the amount is required", () => {
    expect(leaseBodySchema.safeParse(ok).success).toBe(true);
  });

  it("accepts an integer amount and a numeric amount", () => {
    expect(leaseBodySchema.safeParse({ monthlyRentAmount: "1450" }).success).toBe(true);
    expect(leaseBodySchema.safeParse({ monthlyRentAmount: 1450 }).success).toBe(true);
  });

  it("rejects zero, negative, and over-precise amounts", () => {
    for (const v of ["0", "-100", "1450.005", "1,450", "abc", ""]) {
      expect(leaseBodySchema.safeParse({ monthlyRentAmount: v }).success, v).toBe(false);
    }
  });

  it("parses a valid date to UTC midnight", () => {
    const parsed = leaseBodySchema.safeParse({ ...ok, leaseStartDate: "2026-06-30" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.leaseStartDate?.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    }
  });

  it("rejects a date that looks well-formed but is not a real day", () => {
    // new Date("2026-02-31") silently rolls to March 3 — the regex alone would pass it.
    for (const d of ["2026-02-31", "2026-13-01", "2026-00-10", "2025-02-29"]) {
      expect(leaseBodySchema.safeParse({ ...ok, leaseStartDate: d }).success, d).toBe(false);
    }
  });

  it("rejects an end date before the start date, and allows them equal", () => {
    expect(
      leaseBodySchema.safeParse({ ...ok, leaseStartDate: "2026-06-30", leaseEndDate: "2026-06-29" })
        .success,
    ).toBe(false);
    expect(
      leaseBodySchema.safeParse({ ...ok, leaseStartDate: "2026-06-30", leaseEndDate: "2026-06-30" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed landlord email", () => {
    expect(leaseBodySchema.safeParse({ ...ok, landlordEmail: "not-an-email" }).success).toBe(false);
  });
});

describe("leasePatchSchema", () => {
  it("allows an empty object at the schema level — the route rejects it as a no-op", () => {
    // Emptiness is a route concern, not a shape concern: the schema cannot tell an
    // intentional no-op from a bug, but the handler can answer 400 either way.
    expect(leasePatchSchema.safeParse({}).success).toBe(true);
  });

  it("distinguishes an explicit null (clear the field) from an absent key (leave it)", () => {
    const cleared = leasePatchSchema.safeParse({ landlordEmail: null });
    expect(cleared.success).toBe(true);
    if (cleared.success) {
      expect("landlordEmail" in cleared.data).toBe(true);
      expect(cleared.data.landlordEmail).toBeNull();
    }

    const untouched = leasePatchSchema.safeParse({ landlordName: "Acme" });
    expect(untouched.success).toBe(true);
    if (untouched.success) expect("landlordEmail" in untouched.data).toBe(false);
  });

  it("still rejects an invalid amount when one is supplied", () => {
    expect(leasePatchSchema.safeParse({ monthlyRentAmount: "-1" }).success).toBe(false);
  });
});
