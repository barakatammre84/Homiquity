import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { documents } from "@shared/schema";
import type { Document } from "@shared/schema";
import {
  toStaffDocumentView,
  toBorrowerDocumentView,
  toDocumentViewForRole,
  toDocumentViewsForRole,
  SERVER_ONLY_DOCUMENT_COLUMNS,
  BORROWER_EMBARGOED_DOCUMENT_COLUMNS,
} from "@shared/borrowerDocumentView";
import { ALL_ROLES, STAFF_ROLES, CLIENT_ROLES, PARTNER_ROLES } from "@shared/roles";

/**
 * Borrower Clarity PR 4 follow-up (security review 2026-08-04): every route
 * that serializes documents rows now flows through this subtraction. Field
 * absence is pinned here so a future `res.json(docs)` refactor can't quietly
 * re-ship the extraction ciphertext or the staff reviewer id.
 */

const makeDoc = (): Document =>
  ({
    id: "doc-1",
    userId: "borrower-user-1",
    applicationId: "app-1",
    documentType: "bank_statement",
    fileName: "statement-june.pdf",
    fileSize: 48213,
    mimeType: "application/pdf",
    storagePath: "/objects/uploads/abc123",
    status: "rejected",
    rejectionReason: "Please upload all pages, including page 2.",
    reviewedByUserId: "staff-user-99",
    reviewedAt: new Date("2026-08-03T00:00:00Z"),
    notes: null,
    extractionResponseHash: "sha256:deadbeef",
    extractionRawEncrypted: "ZW5jcnlwdGVkLWNpcGhlcnRleHQ=",
    extractionRawIv: "aXYtYnl0ZXM=",
    extractionRawKeyId: "key-2026-08",
    createdAt: new Date("2026-08-01T00:00:00Z"),
  }) as unknown as Document;

describe("toBorrowerDocumentView — client-role subtraction", () => {
  it("drops the ciphertext trio and the staff reviewer id", () => {
    const view = toBorrowerDocumentView(makeDoc());
    for (const field of BORROWER_EMBARGOED_DOCUMENT_COLUMNS) {
      expect(view, `embargoed column leaked: ${field}`).not.toHaveProperty(field);
    }
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("ZW5jcnlwdGVkLWNpcGhlcnRleHQ=");
    expect(serialized).not.toContain("aXYtYnl0ZXM=");
    expect(serialized).not.toContain("key-2026-08");
    expect(serialized).not.toContain("staff-user-99");
  });

  it("keeps rejectionReason (borrower-facing copy) and the ordinary row facts", () => {
    const view = toBorrowerDocumentView(makeDoc());
    expect(view.rejectionReason).toBe("Please upload all pages, including page 2.");
    expect(view.id).toBe("doc-1");
    expect(view.fileName).toBe("statement-june.pdf");
    expect(view.status).toBe("rejected");
    expect(view.reviewedAt).toEqual(new Date("2026-08-03T00:00:00Z"));
    expect(view.extractionResponseHash).toBe("sha256:deadbeef");
  });
});

describe("toStaffDocumentView — staff still never get the ciphertext", () => {
  it("drops exactly the server-only trio and keeps the reviewer id", () => {
    const view = toStaffDocumentView(makeDoc());
    for (const field of SERVER_ONLY_DOCUMENT_COLUMNS) {
      expect(view, `server-only column leaked: ${field}`).not.toHaveProperty(field);
    }
    expect(view.reviewedByUserId).toBe("staff-user-99");
    expect(view.rejectionReason).toBe("Please upload all pages, including page 2.");
  });
});

describe("toDocumentViewForRole — role dispatch", () => {
  it("staff roles (incl. deal-team broker/lender) keep reviewedByUserId", () => {
    for (const role of STAFF_ROLES) {
      const view = toDocumentViewForRole(makeDoc(), role);
      expect(view, role).toHaveProperty("reviewedByUserId", "staff-user-99");
    }
  });

  it("client and self-registering partner roles never see reviewedByUserId", () => {
    for (const role of [...CLIENT_ROLES, ...PARTNER_ROLES]) {
      const view = toDocumentViewForRole(makeDoc(), role);
      expect(view, role).not.toHaveProperty("reviewedByUserId");
    }
  });

  it("no role — and no unknown role — ever receives the ciphertext trio", () => {
    for (const role of [...ALL_ROLES, "not-a-role", ""]) {
      const serialized = JSON.stringify(toDocumentViewForRole(makeDoc(), role));
      expect(serialized, role).not.toContain("ZW5jcnlwdGVkLWNpcGhlcnRleHQ=");
      expect(serialized, role).not.toContain("aXYtYnl0ZXM=");
      expect(serialized, role).not.toContain("key-2026-08");
    }
  });

  it("maps arrays through toDocumentViewsForRole", () => {
    const views = toDocumentViewsForRole([makeDoc(), makeDoc()], "active_buyer");
    expect(views).toHaveLength(2);
    for (const view of views) {
      expect(view).not.toHaveProperty("reviewedByUserId");
      expect(view).not.toHaveProperty("extractionRawEncrypted");
    }
  });
});

describe("embargo lists stay anchored to the live documents table", () => {
  const columns = Object.keys(getTableColumns(documents));

  it("every embargoed name is a real column — a rename fails here instead of silently un-masking", () => {
    expect(BORROWER_EMBARGOED_DOCUMENT_COLUMNS.filter((c) => !columns.includes(c))).toEqual([]);
  });

  it("the borrower embargo is the server-only trio plus exactly reviewedByUserId", () => {
    const extra = BORROWER_EMBARGOED_DOCUMENT_COLUMNS.filter(
      (c) => !(SERVER_ONLY_DOCUMENT_COLUMNS as readonly string[]).includes(c),
    );
    expect(extra).toEqual(["reviewedByUserId"]);
  });
});
