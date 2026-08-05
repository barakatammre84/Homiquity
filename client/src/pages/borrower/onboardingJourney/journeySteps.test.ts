import { describe, it, expect } from "vitest";
import {
  getBorrowerTypeDescription,
  getBorrowerTypeIcon,
  getBorrowerTypeLabel,
  getJourneySteps,
  summariseJourney,
  type ConsentStatus,
  type OnboardingStatus,
} from "./journeySteps";

const status = (over: Partial<OnboardingStatus> = {}): OnboardingStatus => ({
  profile: null,
  kba: null,
  kyc: null,
  verifications: [],
  borrowerType: "standard",
  applicationId: null,
  applicationStatus: null,
  ...over,
});

const consents = (over: Partial<ConsentStatus> = {}): ConsentStatus => ({
  eDisclosureGiven: false,
  creditConsentGiven: false,
  ...over,
});

/** Everything the status endpoint can actually report as done. */
const fullyDone = () =>
  status({
    kba: { status: "passed" },
    kyc: { overallStatus: "cleared" },
    verifications: [{ verificationType: "identity", status: "verified" }],
    applicationId: "app-1",
    applicationStatus: "pre_approved",
  });

const ids = (s: OnboardingStatus, c = consents()) => getJourneySteps(s, c).map(x => x.id);

describe("borrower type presentation", () => {
  it("labels each type and falls back to Standard", () => {
    expect(getBorrowerTypeLabel("first_time_buyer")).toBe("First-Time Buyer");
    expect(getBorrowerTypeLabel("self_employed")).toBe("Self-Employed");
    expect(getBorrowerTypeLabel("non_qm")).toBe("Non-QM");
    expect(getBorrowerTypeLabel("something_new")).toBe("Standard");
  });

  it("gives every type a distinct description and icon", () => {
    const types = ["first_time_buyer", "self_employed", "non_qm", "standard"];
    expect(new Set(types.map(getBorrowerTypeDescription)).size).toBe(4);
    expect(new Set(types.map(getBorrowerTypeIcon)).size).toBe(4);
  });
});

describe("getJourneySteps — shape", () => {
  it("gives a standard borrower the seven shared steps in order", () => {
    expect(ids(status())).toEqual([
      "application", "identity", "documents", "e_consent", "credit_consent", "review", "approval",
    ]);
  });

  it("appends type-specific steps before review/approval", () => {
    expect(ids(status({ borrowerType: "first_time_buyer" }))).toContain("education");
    expect(ids(status({ borrowerType: "self_employed" }))).toContain("tax_docs");
    expect(ids(status({ borrowerType: "non_qm" }))).toContain("alt_docs");
    // Review and approval always close the list, whatever was inserted.
    for (const borrowerType of ["standard", "first_time_buyer", "self_employed", "non_qm"]) {
      expect(ids(status({ borrowerType })).slice(-2), borrowerType).toEqual(["review", "approval"]);
    }
  });

  it("gives every step a title, description and stable id", () => {
    const steps = getJourneySteps(status({ borrowerType: "non_qm" }), consents());
    expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
    for (const s of steps) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.description.length, s.id).toBeGreaterThan(0);
    }
  });

  it("marks only the two educational first-time-buyer steps optional", () => {
    const steps = getJourneySteps(status({ borrowerType: "first_time_buyer" }), consents());
    expect(steps.filter(s => !s.required).map(s => s.id)).toEqual(["education", "affordability"]);
  });
});

describe("getJourneySteps — completion", () => {
  it("starts a brand-new borrower on the application step and nothing else", () => {
    const steps = getJourneySteps(status(), consents());
    expect(steps.filter(s => s.complete)).toHaveLength(0);
    expect(steps.filter(s => s.active).map(s => s.id)).toEqual(["application"]);
  });

  it("requires both KBA pass and KYC clearance for the identity step", () => {
    const kbaOnly = getJourneySteps(status({ applicationId: "a", kba: { status: "passed" } }), consents());
    expect(kbaOnly.find(s => s.id === "identity")!.complete).toBe(false);

    const both = getJourneySteps(
      status({ applicationId: "a", kba: { status: "passed" }, kyc: { overallStatus: "cleared" } }),
      consents(),
    );
    expect(both.find(s => s.id === "identity")!.complete).toBe(true);
  });

  it("reads consent completion from the live checks, not a hardcoded false", () => {
    // The ux-07 fix: before these were wired up, progress could never reach
    // 100% and "Up Next" pointed back at a step already finished.
    const off = getJourneySteps(status({ applicationId: "a" }), consents());
    expect(off.find(s => s.id === "e_consent")!.complete).toBe(false);
    expect(off.find(s => s.id === "credit_consent")!.complete).toBe(false);

    const on = getJourneySteps(
      status({ applicationId: "a" }),
      consents({ eDisclosureGiven: true, creditConsentGiven: true }),
    );
    expect(on.find(s => s.id === "e_consent")!.complete).toBe(true);
    expect(on.find(s => s.id === "credit_consent")!.complete).toBe(true);
  });

  it("counts only an approved or pre-approved application as review/approval done", () => {
    for (const applicationStatus of ["submitted", "in_review", "denied", null]) {
      const steps = getJourneySteps(status({ applicationId: "a", applicationStatus }), consents());
      expect(steps.find(s => s.id === "approval")!.complete, String(applicationStatus)).toBe(false);
    }
    for (const applicationStatus of ["pre_approved", "approved"]) {
      const steps = getJourneySteps(status({ applicationId: "a", applicationStatus }), consents());
      expect(steps.find(s => s.id === "approval")!.complete, applicationStatus).toBe(true);
    }
  });

  it("treats a missing verifications array as nothing verified rather than crashing", () => {
    // The endpoint has always sent it, but `complete: docsVerified || false`
    // exists precisely because the optional chain can produce undefined.
    const steps = getJourneySteps(
      { ...status({ applicationId: "a" }), verifications: undefined as never },
      consents(),
    );
    expect(steps.find(s => s.id === "documents")!.complete).toBe(false);
  });
});

describe("summariseJourney", () => {
  it("reports 0% for a borrower who has done nothing", () => {
    const s = summariseJourney(getJourneySteps(status(), consents()));
    expect(s.completedCount).toBe(0);
    expect(s.progressPercent).toBe(0);
    expect(s.nextStep!.id).toBe("application");
  });

  it("reaches 100% for a standard borrower who finishes everything", () => {
    const s = summariseJourney(
      getJourneySteps(fullyDone(), consents({ eDisclosureGiven: true, creditConsentGiven: true })),
    );
    expect(s.progressPercent).toBe(100);
    expect(s.nextStep).toBeUndefined();
  });

  it("skips completed steps when choosing the Up Next target", () => {
    const steps = getJourneySteps(
      status({ applicationId: "a", kba: { status: "passed" }, kyc: { overallStatus: "cleared" } }),
      consents({ eDisclosureGiven: true }),
    );
    // application/identity complete, documents next.
    expect(summariseJourney(steps).nextStep!.id).toBe("documents");
  });

  it("PINNED: a self-employed borrower can never reach 100%", () => {
    // tax_docs and bank_statements hardcode complete: false because
    // /api/onboarding/status reports no per-document-category progress. This
    // is the known gap documented at the top of journeySteps.ts — the test
    // exists so it stays visible, not because the behaviour is desirable. If
    // the endpoint ever starts reporting document categories, this test
    // should fail and be deleted along with the hardcoded flags.
    const s = summariseJourney(
      getJourneySteps(
        { ...fullyDone(), borrowerType: "self_employed" },
        consents({ eDisclosureGiven: true, creditConsentGiven: true }),
      ),
    );
    expect(s.progressPercent).toBeLessThan(100);
    expect(s.nextStep!.id).toBe("tax_docs");
  });

  it("PINNED: non-QM and first-time-buyer paths cap below 100% too", () => {
    const cap = (borrowerType: string) =>
      summariseJourney(
        getJourneySteps(
          { ...fullyDone(), borrowerType },
          consents({ eDisclosureGiven: true, creditConsentGiven: true }),
        ),
      ).progressPercent;
    expect(cap("non_qm")).toBeLessThan(100);
    // The first-time-buyer shortfall is the two optional education steps, so
    // it is far less serious — but it still shows as an unfinished journey.
    expect(cap("first_time_buyer")).toBeLessThan(100);
    expect(cap("standard")).toBe(100);
  });

  it("rounds the percentage to a whole number", () => {
    const s = summariseJourney(
      getJourneySteps(status({ applicationId: "a" }), consents()),
    );
    expect(Number.isInteger(s.progressPercent)).toBe(true);
  });
});
