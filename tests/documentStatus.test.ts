import { describe, expect, it } from "vitest";

import {
  CHECKLIST_ITEM_STATUSES,
  DOCUMENT_REVIEW_ROLES,
  DOCUMENT_STATUS,
  DOCUMENT_STATUSES,
  canReviewDocuments,
  isDocumentStatus,
} from "@shared/documentStatus";
import { getDocumentStatusLabel } from "@/lib/formatters";

describe("document status vocabulary (shared/documentStatus.ts)", () => {
  it("covers exactly the four lifecycle states the server writes", () => {
    expect([...DOCUMENT_STATUSES]).toEqual(["uploaded", "verifying", "verified", "rejected"]);
    expect(Object.values(DOCUMENT_STATUS).sort()).toEqual([...DOCUMENT_STATUSES].sort());
  });

  it("checklist statuses are the document statuses plus 'needed'", () => {
    expect([...CHECKLIST_ITEM_STATUSES]).toEqual(["needed", ...DOCUMENT_STATUSES]);
  });

  it("isDocumentStatus accepts the vocabulary and nothing else", () => {
    for (const s of DOCUMENT_STATUSES) expect(isDocumentStatus(s)).toBe(true);
    // The badge a stale client build once mapped — the server never writes it.
    expect(isDocumentStatus("pending_review")).toBe(false);
    expect(isDocumentStatus("")).toBe(false);
  });

  it("review roles mirror the server gate: internal reviewers only", () => {
    expect([...DOCUMENT_REVIEW_ROLES]).toEqual(["admin", "lo", "loa", "processor", "underwriter"]);
    for (const role of DOCUMENT_REVIEW_ROLES) expect(canReviewDocuments(role)).toBe(true);
    // External partners and non-reviewing staff must never see review controls.
    for (const role of ["broker", "lender", "closer", "cpa", "realtor", "active_buyer", "", undefined]) {
      expect(canReviewDocuments(role as string | undefined), `role ${role}`).toBe(false);
    }
  });
});

describe("getDocumentStatusLabel (client/src/lib/formatters.ts)", () => {
  it("borrower labels collapse the internal staging into Under Review", () => {
    expect(getDocumentStatusLabel("uploaded")).toBe("Under Review");
    expect(getDocumentStatusLabel("verifying")).toBe("Under Review");
    expect(getDocumentStatusLabel("verified")).toBe("Accepted");
    expect(getDocumentStatusLabel("rejected")).toBe("Action Needed");
  });

  it("staff labels show the literal review state", () => {
    expect(getDocumentStatusLabel("uploaded", "staff")).toBe("Uploaded");
    expect(getDocumentStatusLabel("verifying", "staff")).toBe("Needs Review");
    expect(getDocumentStatusLabel("verified", "staff")).toBe("Verified");
    expect(getDocumentStatusLabel("rejected", "staff")).toBe("Rejected");
  });

  it("null/undefined behave as the registration default (uploaded)", () => {
    expect(getDocumentStatusLabel(null)).toBe("Under Review");
    expect(getDocumentStatusLabel(undefined, "staff")).toBe("Uploaded");
  });

  it("unknown statuses humanize instead of leaking snake_case", () => {
    expect(getDocumentStatusLabel("pending_review")).toBe("Pending Review");
  });

  it('no document status ever renders as "Approved" — a document review is not a loan decision (Reg N)', () => {
    for (const status of [...DOCUMENT_STATUSES, "pending_review", null]) {
      for (const audience of ["borrower", "staff"] as const) {
        const label = getDocumentStatusLabel(status, audience).toLowerCase();
        expect(label, `label for ${status}/${audience}`).not.toContain("approv");
      }
    }
  });
});
