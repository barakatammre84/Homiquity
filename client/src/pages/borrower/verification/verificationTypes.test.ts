import { describe, it, expect } from "vitest";
import {
  REQUIRED_VERIFICATION_TYPES,
  findVerification,
  statusBadgeSpec,
  verificationProgress,
  verificationStatus,
  verificationTypes,
} from "./verificationTypes";
import type { Verification } from "@shared/schema";

const v = (verificationType: string, status: string) =>
  ({ verificationType, status }) as Verification;

describe("verificationTypes catalog", () => {
  it("requires employment and identity, and only those", () => {
    expect([...REQUIRED_VERIFICATION_TYPES].sort()).toEqual(["employment", "identity"]);
  });

  it("gives every type a unique key, title and description", () => {
    expect(new Set(verificationTypes.map(t => t.type)).size).toBe(verificationTypes.length);
    for (const t of verificationTypes) {
      expect(t.title.length, t.type).toBeGreaterThan(0);
      expect(t.description.length, t.type).toBeGreaterThan(0);
    }
  });
});

describe("statusBadgeSpec", () => {
  it("labels every known status", () => {
    expect(statusBadgeSpec("pending").label).toBe("Not Started");
    expect(statusBadgeSpec("in_progress").label).toBe("In Progress");
    expect(statusBadgeSpec("verified").label).toBe("Verified");
    expect(statusBadgeSpec("failed").label).toBe("Failed");
    expect(statusBadgeSpec("expired").label).toBe("Expired");
  });

  it("marks only failure as destructive", () => {
    expect(statusBadgeSpec("failed").variant).toBe("destructive");
    for (const s of ["pending", "in_progress", "verified", "expired"]) {
      expect(statusBadgeSpec(s).variant, s).not.toBe("destructive");
    }
  });

  it("shows an unmapped status raw rather than rendering blank", () => {
    expect(statusBadgeSpec("cancelled")).toEqual({ variant: "secondary", label: "cancelled" });
  });
});

describe("verificationStatus / findVerification", () => {
  it("defaults to pending when nothing has been recorded", () => {
    expect(verificationStatus(undefined, "employment")).toBe("pending");
    expect(verificationStatus([], "employment")).toBe("pending");
    expect(findVerification([], "employment")).toBeUndefined();
  });

  it("matches on verification type", () => {
    const list = [v("income", "verified"), v("employment", "failed")];
    expect(verificationStatus(list, "employment")).toBe("failed");
    expect(verificationStatus(list, "income")).toBe("verified");
    expect(verificationStatus(list, "assets")).toBe("pending");
  });
});

describe("verificationProgress", () => {
  it("reports 0 of 2 with nothing verified", () => {
    expect(verificationProgress([])).toEqual({
      completedCount: 0, totalRequired: 2, allRequiredComplete: false,
    });
    expect(verificationProgress(undefined).completedCount).toBe(0);
  });

  it("counts each required verification once complete", () => {
    expect(verificationProgress([v("employment", "verified")]).completedCount).toBe(1);
    expect(verificationProgress([
      v("employment", "verified"), v("identity", "verified"),
    ])).toEqual({ completedCount: 2, totalRequired: 2, allRequiredComplete: true });
  });

  it("does not let optional verifications satisfy the required count", () => {
    // The bug this fixes: counting every verified record meant income + assets
    // — both optional — read as "2 of 2 required verifications complete" under
    // an "All Required Complete" badge, with employment and identity still
    // outstanding.
    const optionalOnly = verificationProgress([
      v("income", "verified"),
      v("assets", "verified"),
    ]);
    expect(optionalOnly.completedCount).toBe(0);
    expect(optionalOnly.allRequiredComplete).toBe(false);
  });

  it("ignores required verifications that are not yet verified", () => {
    for (const status of ["pending", "in_progress", "failed", "expired"]) {
      expect(verificationProgress([v("employment", status)]).completedCount, status).toBe(0);
    }
  });

  it("counts a mix correctly", () => {
    const p = verificationProgress([
      v("employment", "verified"),
      v("identity", "in_progress"),
      v("income", "verified"),
      v("assets", "verified"),
    ]);
    expect(p.completedCount).toBe(1);
    expect(p.allRequiredComplete).toBe(false);
  });
});
