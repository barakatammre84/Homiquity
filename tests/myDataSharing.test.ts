import { describe, it, expect } from "vitest";
import {
  SUBMISSION_STATUS_META,
  SHARED_PACKAGE_CONTENTS,
  humanizeConsentType,
  toBorrowerSubmissionView,
  toCreditConsentView,
  toPlatformConsentView,
} from "../shared/myDataSharing";
import { LENDER_SUBMISSION_STATUSES } from "../shared/wholesaleLenders";
import type { LenderSubmission } from "../shared/schema/delivery";
import type { CreditConsent, BorrowerConsent } from "../shared/schema/compliance";

// ---------------------------------------------------------------------------
// Fixtures — deliberately loaded with every staff-internal / PII-adjacent
// column so the leak assertions below mean something.
// ---------------------------------------------------------------------------

const STAFF_NOTE = "UWM AE Jane Doe said borrower LTV is borderline — chase 2nd paystub";
const READINESS_MARKER = "stage-3-blocker-internal";
const XML_MARKER = "<MESSAGE>full-borrower-file-xml</MESSAGE>";
const STAFF_USER_ID = "staff-user-777";

function makeSubmission(overrides: Partial<LenderSubmission> = {}): LenderSubmission {
  return {
    id: "sub-1",
    applicationId: "app-1",
    lenderId: "uwm",
    status: "in_underwriting",
    simulated: true,
    confirmationId: "UWM-000123456",
    readinessSnapshot: { internal: READINESS_MARKER },
    mismoPackageXml: XML_MARKER,
    mismoPackageHash: "a".repeat(64),
    mismoPackageGeneratedAt: new Date("2026-07-01T10:00:00Z"),
    submittedBy: STAFF_USER_ID,
    submittedAt: new Date("2026-07-01T10:00:05Z"),
    notes: STAFF_NOTE,
    statusUpdatedAt: new Date("2026-07-03T09:00:00Z"),
    createdAt: new Date("2026-07-01T10:00:05Z"),
    updatedAt: new Date("2026-07-03T09:00:00Z"),
    ...overrides,
  } as LenderSubmission;
}

function makeCreditConsent(overrides: Partial<CreditConsent> = {}): CreditConsent {
  return {
    id: "consent-1",
    applicationId: "app-1",
    userId: "user-1",
    consentType: "soft_pull",
    disclosureVersion: "FCRA-2026-v1",
    disclosureText: "Full FCRA disclosure body …",
    consentGiven: true,
    consentTimestamp: new Date("2026-06-20T15:30:00Z"),
    borrowerFullName: "Ada Borrower",
    borrowerSSNLast4: "6789",
    borrowerDOB: "1990-01-15",
    ipAddress: "203.0.113.7",
    userAgent: "Mozilla/5.0 test",
    signatureType: "electronic",
    isActive: true,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date("2026-06-20T15:30:00Z"),
    updatedAt: new Date("2026-06-20T15:30:00Z"),
    ...overrides,
  } as CreditConsent;
}

function makePlatformConsent(overrides: Partial<BorrowerConsent> = {}): BorrowerConsent {
  return {
    id: "bconsent-1",
    userId: "user-1",
    applicationId: "app-1",
    templateId: "tmpl-1",
    consentType: "econsent",
    templateVersion: "1.2.0",
    consentGiven: true,
    consentMethod: "click",
    signatureData: "base64-signature-image",
    signatureType: "typed",
    ipAddress: "203.0.113.7",
    userAgent: "Mozilla/5.0 test",
    browserFingerprint: "f".repeat(64),
    consentedAt: new Date("2026-06-20T15:31:00Z"),
    isRevoked: false,
    revokedAt: null,
    revocationReason: null,
    contentHash: "c".repeat(64),
    createdAt: new Date("2026-06-20T15:31:00Z"),
    ...overrides,
  } as BorrowerConsent;
}

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------

describe("submission status metadata", () => {
  it("covers every status in the wholesale submission machine", () => {
    for (const status of LENDER_SUBMISSION_STATUSES) {
      const meta = SUBMISSION_STATUS_META[status];
      expect(meta, `missing borrower-facing copy for status "${status}"`).toBeDefined();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
    // ...and nothing extra that the machine doesn't know about.
    expect(Object.keys(SUBMISSION_STATUS_META).sort()).toEqual(
      [...LENDER_SUBMISSION_STATUSES].sort(),
    );
  });

  it("uses only design-system badge tones", () => {
    const validTones = ["info", "success", "warning", "destructive", "secondary"];
    for (const meta of Object.values(SUBMISSION_STATUS_META)) {
      expect(validTones).toContain(meta.tone);
    }
  });

  it("marks exactly the terminal statuses as terminal", () => {
    const terminal = Object.entries(SUBMISSION_STATUS_META)
      .filter(([, meta]) => meta.terminal)
      .map(([status]) => status)
      .sort();
    expect(terminal).toEqual(["denied", "funded", "withdrawn"]);
  });
});

// ---------------------------------------------------------------------------
// Submission view — the borrower must see their sharing record, and must NOT
// see staff notes, readiness internals, the raw MISMO XML, or staff user ids.
// ---------------------------------------------------------------------------

describe("toBorrowerSubmissionView", () => {
  it("resolves the lender from the Target-5 catalog", () => {
    const view = toBorrowerSubmissionView(makeSubmission());
    expect(view.lenderName).toBe("United Wholesale Mortgage");
    expect(view.lenderSpecialty).toContain("Conventional");
    expect(view.status).toBe("in_underwriting");
    expect(view.statusLabel).toBe("Under review");
    expect(view.statusTone).toBe("info");
    expect(view.confirmationId).toBe("UWM-000123456");
    expect(view.submittedAt).toBe("2026-07-01T10:00:05.000Z");
    expect(view.statusUpdatedAt).toBe("2026-07-03T09:00:00.000Z");
    expect(view.packageFingerprint).toBe("a".repeat(64));
    expect(view.simulated).toBe(true);
  });

  it("never leaks staff-internal fields into the payload", () => {
    const serialized = JSON.stringify(toBorrowerSubmissionView(makeSubmission()));
    expect(serialized).not.toContain(STAFF_NOTE);
    expect(serialized).not.toContain(READINESS_MARKER);
    expect(serialized).not.toContain(XML_MARKER);
    expect(serialized).not.toContain(STAFF_USER_ID);
  });

  it("exposes exactly the whitelisted keys — a new column cannot leak by default", () => {
    const view = toBorrowerSubmissionView(makeSubmission());
    expect(Object.keys(view).sort()).toEqual(
      [
        "id",
        "lenderId",
        "lenderName",
        "lenderSpecialty",
        "status",
        "statusLabel",
        "statusDescription",
        "statusTone",
        "isTerminal",
        "simulated",
        "confirmationId",
        "submittedAt",
        "statusUpdatedAt",
        "packageFingerprint",
        "packageGeneratedAt",
        "sharedData",
      ].sort(),
    );
  });

  it("describes what was shared using the static MISMO package contents", () => {
    const view = toBorrowerSubmissionView(makeSubmission());
    expect(view.sharedData).toBe(SHARED_PACKAGE_CONTENTS);
    expect(view.sharedData.length).toBeGreaterThan(0);
  });

  it("falls back gracefully for a lender id no longer in the catalog", () => {
    const view = toBorrowerSubmissionView(makeSubmission({ lenderId: "retired-lender" }));
    expect(view.lenderName).toBe("retired-lender");
    expect(view.lenderSpecialty).toBeNull();
  });

  it("falls back to 'submitted' presentation for an unrecognized status value", () => {
    const view = toBorrowerSubmissionView(makeSubmission({ status: "weird_db_value" }));
    expect(view.status).toBe("submitted");
    expect(view.statusLabel).toBe("Sent to lender");
  });

  it("handles nullable columns", () => {
    const view = toBorrowerSubmissionView(
      makeSubmission({
        confirmationId: null,
        mismoPackageHash: null,
        mismoPackageGeneratedAt: null,
        statusUpdatedAt: null,
      }),
    );
    expect(view.confirmationId).toBeNull();
    expect(view.packageFingerprint).toBeNull();
    expect(view.packageGeneratedAt).toBeNull();
    expect(view.statusUpdatedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Credit consent view — soft-pull authorization record, without SSN last-4,
// DOB, IP, user agent, or the full disclosure body.
// ---------------------------------------------------------------------------

describe("toCreditConsentView", () => {
  it("maps the soft-pull authorization for borrower display", () => {
    const view = toCreditConsentView(makeCreditConsent());
    expect(view.kind).toBe("credit");
    expect(view.label).toContain("Soft credit check");
    expect(view.disclosureVersion).toBe("FCRA-2026-v1");
    expect(view.consentGiven).toBe(true);
    expect(view.consentedAt).toBe("2026-06-20T15:30:00.000Z");
    expect(view.isActive).toBe(true);
  });

  it("never leaks PII-adjacent consent columns", () => {
    const serialized = JSON.stringify(toCreditConsentView(makeCreditConsent()));
    expect(serialized).not.toContain("6789"); // SSN last-4
    expect(serialized).not.toContain("1990-01-15"); // DOB
    expect(serialized).not.toContain("203.0.113.7"); // IP
    expect(serialized).not.toContain("Mozilla"); // user agent
    expect(serialized).not.toContain("Full FCRA disclosure"); // disclosure body
    expect(serialized).not.toContain("Ada Borrower"); // name lives in the profile, not here
  });

  it("surfaces revocation", () => {
    const view = toCreditConsentView(
      makeCreditConsent({
        isActive: false,
        revokedAt: new Date("2026-07-01T00:00:00Z"),
        revokedReason: "Borrower request",
      }),
    );
    expect(view.isActive).toBe(false);
    expect(view.revokedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(view.revokedReason).toBe("Borrower request");
  });

  it("surfaces a declined consent", () => {
    const view = toCreditConsentView(makeCreditConsent({ consentGiven: false }));
    expect(view.consentGiven).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Platform consent view — eConsent / communications ledger, without signature
// images, fingerprints, IP, or user agent.
// ---------------------------------------------------------------------------

describe("toPlatformConsentView", () => {
  it("maps an eConsent record with curated copy", () => {
    const view = toPlatformConsentView(makePlatformConsent());
    expect(view.kind).toBe("platform");
    expect(view.label).toBe("Electronic records & communications (eConsent)");
    expect(view.templateVersion).toBe("1.2.0");
    expect(view.consentMethod).toBe("click");
    expect(view.isRevoked).toBe(false);
  });

  it("never leaks signature data, fingerprints, or network metadata", () => {
    const serialized = JSON.stringify(toPlatformConsentView(makePlatformConsent()));
    expect(serialized).not.toContain("base64-signature-image");
    expect(serialized).not.toContain("f".repeat(64)); // browser fingerprint
    expect(serialized).not.toContain("203.0.113.7");
    expect(serialized).not.toContain("Mozilla");
    expect(serialized).not.toContain("c".repeat(64)); // content hash
  });

  it("surfaces revocation", () => {
    const view = toPlatformConsentView(
      makePlatformConsent({ isRevoked: true, revokedAt: new Date("2026-07-02T00:00:00Z") }),
    );
    expect(view.isRevoked).toBe(true);
    expect(view.revokedAt).toBe("2026-07-02T00:00:00.000Z");
  });

  it("humanizes consent types without curated copy", () => {
    const view = toPlatformConsentView(makePlatformConsent({ consentType: "future_new_consent" }));
    expect(view.label).toBe("Future new consent");
    expect(humanizeConsentType("intent_to_proceed")).toBe("Intent to proceed");
  });

  it("carries curated copy for the anti-steering disclosure seeded by consentGate", () => {
    const view = toPlatformConsentView(makePlatformConsent({ consentType: "anti_steering" }));
    expect(view.label).toBe("Anti-steering loan options disclosure");
  });
});
