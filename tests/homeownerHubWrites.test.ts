import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import { insertHomeownerProfileSchema } from "../shared/schema";
import { homeownerProfileWriteSchema } from "../server/routes/borrower/homeownerProfilePayload";
import { resolveHomeownerPosition, type HomeownerPosition } from "../server/services/lifecycleEngine";
import type { HomeownerProfile } from "../shared/schema";

// -----------------------------------------------------------------------------
// F-0819-03 — the Homeowner Hub's entire write surface returned 500.
//
// The Hub is a post-close product with exactly one door: the setup form. That
// form renders nine controlled inputs, all initialised to "", and posts the
// whole object. `POST /api/homeowner/profile` handed that object straight to
// Drizzle, which maps a `timestamp` column by calling `.toISOString()` on the
// value and a `decimal` column by handing the string to Postgres. `""` is
// neither, so the insert threw inside the driver, the handler's catch-all turned
// it into a 500, and no owner has ever been able to create a profile — which
// makes every surface behind it unreachable, alerts and equity included.
//
// The first block below pins the bug: the shape the client actually sends is
// rejected by the insert schema, i.e. it was never insertable. The rest pin the
// fix, and the static block pins the *route* wiring, because a correct schema
// nobody calls is exactly the shape this defect had.
// -----------------------------------------------------------------------------

/** Byte-for-byte the state `SetupForm.tsx` initialises and posts. */
const SETUP_FORM_UNTOUCHED = {
  propertyAddress: "",
  originalLoanAmount: "",
  currentLoanBalance: "",
  interestRate: "",
  monthlyPayment: "",
  propertyValue: "",
  purchasePrice: "",
  purchaseDate: "",
  loanCloseDate: "",
};

/** The realistic case: an owner fills in what they know and leaves dates blank. */
const SETUP_FORM_PARTIAL = {
  ...SETUP_FORM_UNTOUCHED,
  propertyAddress: "742 Evergreen Terrace, Springfield, IL 62704",
  originalLoanAmount: "350000",
  currentLoanBalance: "340000",
  interestRate: "6.5",
  propertyValue: "450000",
};

/** What `AnnualReviewSection.tsx` sends on "Schedule Review". */
const ANNUAL_REVIEW_PAYLOAD = {
  nextReviewDate: "2027-08-20",
  lastReviewDate: "2026-08-20",
};

describe("F-0819-03: the payload the Hub sends was never insertable", () => {
  it("the raw insert schema rejects the setup form's own untouched state", () => {
    // This is the defect, stated as an assertion. Remove the validation added in
    // this change and this exact object is what reaches the Postgres driver.
    const parsed = insertHomeownerProfileSchema.omit({ userId: true }).safeParse(SETUP_FORM_UNTOUCHED);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const failed = Object.keys(parsed.error.flatten().fieldErrors);
    expect(failed).toContain("purchaseDate");
    expect(failed).toContain("loanCloseDate");
  });

  it("the raw insert schema rejects the annual-review date strings too", () => {
    const parsed = insertHomeownerProfileSchema
      .omit({ userId: true })
      .partial()
      .safeParse(ANNUAL_REVIEW_PAYLOAD);
    expect(parsed.success).toBe(false);
  });
});

describe("homeownerProfileWriteSchema", () => {
  it("accepts the setup form's untouched state and writes nothing into it", () => {
    const parsed = homeownerProfileWriteSchema.safeParse(SETUP_FORM_UNTOUCHED);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // A blank control is an unanswered question. It must drop out entirely so
    // the column stays NULL — never `new Date("")`, never the string "".
    for (const key of Object.keys(SETUP_FORM_UNTOUCHED)) {
      expect(parsed.data[key as keyof typeof parsed.data]).toBeUndefined();
    }
  });

  it("carries the answers an owner did give, in the shapes the columns take", () => {
    const parsed = homeownerProfileWriteSchema.parse(SETUP_FORM_PARTIAL);
    expect(parsed.propertyAddress).toBe("742 Evergreen Terrace, Springfield, IL 62704");
    expect(parsed.originalLoanAmount).toBe("350000");
    expect(parsed.interestRate).toBe("6.5");
    expect(parsed.purchaseDate).toBeUndefined();
    expect(parsed.loanCloseDate).toBeUndefined();
  });

  it("turns the annual-review date strings into Dates", () => {
    const parsed = homeownerProfileWriteSchema.partial().parse(ANNUAL_REVIEW_PAYLOAD);
    expect(parsed.nextReviewDate).toBeInstanceOf(Date);
    expect(parsed.lastReviewDate).toBeInstanceOf(Date);
    expect((parsed.nextReviewDate as Date).getUTCFullYear()).toBe(2027);
  });

  it("accepts a JSON number for a decimal column and stores it as a string", () => {
    const parsed = homeownerProfileWriteSchema.parse({ propertyValue: 450000 });
    expect(parsed.propertyValue).toBe("450000");
  });

  it("rejects a malformed date instead of letting it reach the driver", () => {
    // The point of the change is a 400 that names the field, not a 500 that
    // names nothing.
    const parsed = homeownerProfileWriteSchema.safeParse({ purchaseDate: "not-a-date" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors).toHaveProperty("purchaseDate");
  });

  it("rejects a non-numeric decimal instead of letting it reach the driver", () => {
    expect(homeownerProfileWriteSchema.safeParse({ propertyValue: "lots" }).success).toBe(false);
  });

  it("strips userId so the wire cannot claim another owner's profile", () => {
    const parsed = homeownerProfileWriteSchema.parse({
      propertyValue: "450000",
      userId: "some-other-user",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("userId");
  });
});

// -----------------------------------------------------------------------------
// The two in-Hub buttons. Both used to POST a body the server inserted verbatim:
// "Record Snapshot" sent only a profile id, so the NOT NULL `snapshot_date` was
// never supplied; "Generate Alert" sent the same, so the NOT NULL rate columns
// were never supplied. Both 500'd on every press. They now run the derivation
// the daily lifecycle sweep already owns, so the value is measured rather than
// typed in — and no borrower-facing savings figure can be composed from the wire.
// -----------------------------------------------------------------------------

function profileFixture(over: Partial<HomeownerProfile> = {}): HomeownerProfile {
  return {
    id: "hp-1",
    userId: "u-1",
    originalLoanAmount: "350000",
    currentLoanBalance: "340000",
    interestRate: "6.500",
    monthlyPayment: "2210.00",
    propertyValue: "450000",
    purchasePrice: "400000",
    purchaseDate: null,
    loanCloseDate: null,
    // No address: the AVM refresh is skipped, so the stored value is the value
    // and the arithmetic below is deterministic.
    propertyAddress: null,
    nextReviewDate: null,
    lastReviewDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as HomeownerProfile;
}

describe("resolveHomeownerPosition", () => {
  it("derives equity from the stored value and balance", async () => {
    const position = (await resolveHomeownerPosition(profileFixture())) as HomeownerPosition;
    expect(position).not.toBeNull();
    expect(position.estimatedValue).toBe(450000);
    expect(position.balance).toBe(340000);
    expect(position.equityAmount).toBe(110000);
    expect(position.equityPercent).toBeCloseTo(24.444, 3);
    expect(position.ltv).toBeCloseTo(75.556, 3);
  });

  it("returns null — not a zero — when the profile cannot support a measurement", async () => {
    // A gap is reported as a gap. The route turns this into a 409 that says what
    // is missing, rather than recording a snapshot of nothing.
    expect(await resolveHomeownerPosition(profileFixture({ propertyValue: null }))).toBeNull();
    expect(
      await resolveHomeownerPosition(
        profileFixture({ currentLoanBalance: null, originalLoanAmount: null }),
      ),
    ).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Wiring. A validator nobody calls is the same defect in a different costume, so
// these read the shipped files rather than trusting the blocks above.
// -----------------------------------------------------------------------------

const REPO = join(__dirname, "..");
const routeSrc = readFileSync(
  join(REPO, "server", "routes", "borrower", "guaranteesHomeowner.ts"),
  "utf8",
);
const equitySrc = readFileSync(
  join(REPO, "client", "src", "pages", "homeowner", "homeownerDashboard", "EquitySection.tsx"),
  "utf8",
);
const refiSrc = readFileSync(
  join(REPO, "client", "src", "pages", "homeowner", "homeownerDashboard", "RefiAlertsSection.tsx"),
  "utf8",
);

describe("the homeowner routes are wired to the validator and the derivation", () => {
  it("never hands req.body to a homeowner write", () => {
    expect(routeSrc).not.toMatch(/createHomeownerProfile\(\{\s*\n?\s*\.\.\.req\.body/);
    expect(routeSrc).not.toMatch(/updateHomeownerProfile\([^)]*req\.body/);
    expect(routeSrc).not.toMatch(/createEquitySnapshot\(/);
    expect(routeSrc).not.toMatch(/createRefiAlert\(/);
  });

  it("validates both profile writes through the shared schema", () => {
    const uses = routeSrc.match(/parseBodyOr400\(\s*homeownerProfileWriteSchema/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it("runs the sweep's own derivation for the two action endpoints", () => {
    expect(routeSrc).toContain("recordEquitySnapshot(profile, position)");
    expect(routeSrc).toContain("evaluateRefiOpportunity(profile, position, marketRate)");
    // Not-created answers 200, created answers 201 — the surface distinguishes them.
    expect(routeSrc).toMatch(/outcome\.created \? 201 : 200/);
  });

  it("reports the outcome instead of an unconditional success toast", () => {
    // The house defect class is an operation that did not happen while the UI
    // says it did. Both buttons now branch on what the server reported.
    expect(equitySrc).toContain("outcome.created");
    expect(equitySrc).toContain("Already up to date");
    expect(refiSrc).toContain("outcome.created");
    expect(refiSrc).toContain("NOT_RAISED[outcome.reason]");
    expect(equitySrc).not.toContain("Equity snapshot has been saved.");
    expect(refiSrc).not.toContain("A new refi alert has been created.");
  });

  it("stops the client supplying fields the server derives", () => {
    expect(equitySrc).not.toContain('"/api/homeowner/equity", { homeownerProfileId');
    expect(refiSrc).not.toContain('"/api/homeowner/refi-alerts", { homeownerProfileId');
  });
});
