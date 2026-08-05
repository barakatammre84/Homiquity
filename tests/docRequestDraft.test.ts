import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDocRequestDraft } from "../server/services/docRequestDraft";

// Roadmap LO-M17: the draft builder mirrors the A8 nudge planner's missing-
// document rules — outstanding upload-ask conditions only, rejected uploads
// don't satisfy, alias-aware matching, one deduplicated ask per document type.

const outstanding = (id: string, title: string, types: string[] | null) => ({
  id,
  status: "outstanding",
  title,
  requiredDocumentTypes: types,
});

describe("buildDocRequestDraft", () => {
  it("drafts an ask for an outstanding condition with no matching upload", () => {
    const items = buildDocRequestDraft(
      [outstanding("c1", "Verify 2024 income", ["w2"])],
      [],
    );
    expect(items).toEqual([
      { documentType: "w2", documentName: "W2", conditionTitles: ["Verify 2024 income"] },
    ]);
  });

  it("a non-rejected upload satisfies; a rejected one does not", () => {
    const conditions = [outstanding("c1", "Income docs", ["w2"])];
    expect(
      buildDocRequestDraft(conditions, [{ documentType: "w2", status: "verified" }]),
    ).toEqual([]);
    expect(
      buildDocRequestDraft(conditions, [{ documentType: "w2", status: "rejected" }]),
    ).toHaveLength(1);
  });

  it("skips non-outstanding conditions and staff tasks with no required types", () => {
    const items = buildDocRequestDraft(
      [
        { id: "sub", status: "submitted", title: "Already in", requiredDocumentTypes: ["w2"] },
        outstanding("staff", "Order appraisal", null),
        outstanding("staff2", "Review title", []),
      ],
      [],
    );
    expect(items).toEqual([]);
  });

  it("dedupes by document type across conditions, carrying every condition title", () => {
    const items = buildDocRequestDraft(
      [
        outstanding("c1", "2023 income", ["tax_return"]),
        outstanding("c2", "2024 income", ["tax_return"]),
      ],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].conditionTitles).toEqual(["2023 income", "2024 income"]);
  });

  it("treats a condition's alternate required types as aliases — one ask, first type canonical", () => {
    const items = buildDocRequestDraft(
      [outstanding("c1", "Prove income", ["pay_stub", "w2"])],
      [],
    );
    expect(items).toHaveLength(1);
    expect(items[0].documentType).toBe("pay_stub");
  });

  it("humanizes the document name", () => {
    const items = buildDocRequestDraft(
      [outstanding("c1", "Bank docs", ["bank_statement"])],
      [],
    );
    expect(items[0].documentName).toBe("Bank statement");
  });
});

describe("route + send-path wiring", () => {
  const repoRoot = resolve(__dirname, "..");
  const cockpit = readFileSync(resolve(repoRoot, "server/routes/cockpit.ts"), "utf8");
  const dialog = readFileSync(
    resolve(repoRoot, "client/src/pages/staff/loCommandCenter/DocRequestDraftDialog.tsx"),
    "utf8",
  );

  it("the draft endpoint carries the cockpit's role gate and assignment scope", () => {
    const at = cockpit.indexOf('"/api/staff/applications/:id/doc-request-draft"');
    expect(at).toBeGreaterThan(-1);
    const registration = cockpit.slice(at, at + 600);
    expect(registration).toContain('requireRole("admin", "lo", "loa", "processor", "underwriter", "closer")');
    expect(registration).toContain("verifyInternalStaffApplicationAccess");
  });

  it("the dialog sends ONLY through the existing POST /api/messages document_request path", () => {
    expect(dialog).toContain('apiRequest("POST", "/api/messages"');
    expect(dialog).toContain('messageType: "document_request"');
    // No bespoke send endpoint — the draft route is read-only.
    expect(cockpit).not.toContain("doc-request-draft/send");
  });
});
