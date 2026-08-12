// Audit finding F-22 — counterparty approval is a business event, not a field
// edit.
//
// `approvalStatus` authorizes transmitting a borrower's file to a third party
// and is the binding constraint on all revenue; `isDemo` is what makes a
// fictional seeded row permanently untransactable. Both used to be writable
// through the generic lender PATCH, whose audit entry recorded field NAMES
// only — a weaker trail than the two sibling admin surfaces that merely move
// numbers.
//
// These tests pin the boundary at the schema layer, which is where it is
// enforced: the generic write schema cannot express an authorization change at
// all, so no route using it can accidentally apply one.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Through the barrel, not the module directly: entering `schema/lendingWholesale`
// on its own trips a module-initialisation cycle in the schema graph.
import {
  insertWholesaleLenderSchema,
  writeWholesaleLenderSchema,
  LENDER_AUTHORIZATION_COLUMNS,
  LENDER_CONTRACT_TERM_COLUMNS,
} from "../shared/schema";

const BASE = {
  lenderId: "test-lender",
  lenderName: "Test Wholesale",
  lenderCode: "TWL",
};

describe("F-22 — authorization columns are not settable through the generic write path", () => {
  it("strips an approvalStatus smuggled into a create body", () => {
    const parsed = writeWholesaleLenderSchema.parse({ ...BASE, approvalStatus: "approved" });
    expect(parsed).not.toHaveProperty("approvalStatus");
  });

  it("strips isDemo, so a demo row cannot be laundered into a real one", () => {
    const parsed = writeWholesaleLenderSchema.partial().parse({ isDemo: false });
    expect(parsed).not.toHaveProperty("isDemo");
    // Both directions: nor can a real lender be disguised as a demo row.
    expect(writeWholesaleLenderSchema.partial().parse({ isDemo: true })).not.toHaveProperty("isDemo");
  });

  it("covers every column named as authorization, so the list cannot drift", () => {
    const shape = Object.keys(writeWholesaleLenderSchema.shape);
    for (const column of LENDER_AUTHORIZATION_COLUMNS) {
      expect(shape).not.toContain(column);
      // Still present on the insert schema, which seeds and storage use — the
      // restriction is on the ROUTE surface, not on the table.
      expect(Object.keys(insertWholesaleLenderSchema.shape)).toContain(column);
    }
  });

  it("leaves ordinary lender attributes writable", () => {
    // The boundary must be narrow. Restricting authorization should not turn
    // the lender screen read-only.
    const parsed = writeWholesaleLenderSchema.partial().parse({ lenderName: "Renamed Wholesale" });
    expect(parsed.lenderName).toBe("Renamed Wholesale");
  });
});

describe("F-22 — the approval endpoint is the only path, and it records evidence", () => {
  const source = readFileSync(join(__dirname, "../server/routes/rate-sheets.ts"), "utf8");

  it("routes generic lender writes through the restricted schema", () => {
    // If either route reverts to insertWholesaleLenderSchema, authorization
    // becomes settable again with no audit of values.
    expect(source).toMatch(/writeWholesaleLenderSchema\.safeParse/);
    expect(source).toMatch(/writeWholesaleLenderSchema\.partial\(\)/);
    expect(source).not.toMatch(/insertWholesaleLenderSchema/);
  });

  it("exposes a dedicated approval endpoint", () => {
    expect(source).toMatch(/app\.post\(\s*"\/api\/wholesale-lenders\/:id\/approval"/);
  });

  it("requires a reason, and an agreement reference to assert approval", () => {
    expect(source).toMatch(/reason: z\.string\(\)/);
    expect(source).toMatch(/brokerAgreementReference is required to approve/);
  });

  it("requires the contracted clawback window on approval (F-23)", () => {
    // Nothing else in the system can write epoClawbackDays, so without this
    // the clawback reserve rests on DEFAULT_EPO_CLAWBACK_DAYS forever.
    expect(source).toMatch(/epoClawbackDays is required to approve a lender/);
  });

  it("refuses to approve a demo counterparty", () => {
    expect(source).toMatch(/cannot_approve_demo_lender/);
  });

  it("audits previous and next VALUES, not just field names", () => {
    expect(source).toMatch(/wholesale_lender\.approval_changed/);
    expect(source).toMatch(/previousApprovalStatus/);
    expect(source).toMatch(/nextApprovalStatus/);
  });

  it("keeps the endpoint admin-gated", () => {
    expect(source).toMatch(
      /app\.post\(\s*"\/api\/wholesale-lenders\/:id\/approval",\s*requireRole\("admin"\)/,
    );
  });
});

describe("F-23 — the clawback window has a correction path, and it is audited", () => {
  const source = readFileSync(join(__dirname, "../server/routes/rate-sheets.ts"), "utf8");

  it("keeps the reserve input off the generic write path", () => {
    // epoClawbackDays feeds the clawback reserve, so a silent edit through the
    // generic PATCH would move a balance-sheet figure with no trail.
    const shape = Object.keys(writeWholesaleLenderSchema.shape);
    for (const column of LENDER_CONTRACT_TERM_COLUMNS) {
      expect(shape).not.toContain(column);
      expect(Object.keys(insertWholesaleLenderSchema.shape)).toContain(column);
    }
  });

  it("exposes a dedicated, admin-gated contract-terms endpoint", () => {
    expect(source).toMatch(
      /app\.patch\(\s*"\/api\/wholesale-lenders\/:id\/contract-terms",\s*requireRole\("admin"\)/,
    );
  });

  it("requires a reason and audits previous -> next values", () => {
    expect(source).toMatch(/wholesale_lender\.contract_terms_updated/);
    expect(source).toMatch(/previousEpoClawbackDays/);
    expect(source).toMatch(/nextEpoClawbackDays/);
  });

  it("accepts null explicitly — 'no term on record' is a real state", () => {
    // Clearing the term returns the register to its flagged assumption, which
    // is honest for a lapsed agreement. Nullable, not merely optional.
    expect(source).toMatch(/epoClawbackDays: z\.number\(\)\.int\(\)\.positive\(\)\.max\(3650\)\.nullable\(\)/);
  });

  it("refuses to record a contracted term for a lender with no agreement", () => {
    expect(source).toMatch(/no_agreement_for_terms/);
  });
});

describe("one handler per path — the lender catalog is not shadowed", () => {
  const rateSheets = readFileSync(join(__dirname, "../server/routes/rate-sheets.ts"), "utf8");
  const submissions = readFileSync(
    join(__dirname, "../server/routes/underwriting/submissions.ts"),
    "utf8",
  );

  it("registers the collection route exactly once, in the file that wins", () => {
    // Two handlers existed on GET /api/wholesale-lenders with different role
    // gates AND different payloads. Express serves the first registered
    // (registerUnderwritingRoutes precedes registerRateSheetRoutes), so the
    // rate-sheets copy was dead — and a registrar reorder would have silently
    // started returning `apiConfig` to the browser.
    expect(submissions).toMatch(/"\/api\/wholesale-lenders"/);
    expect(rateSheets).not.toMatch(/app\.get\(\s*"\/api\/wholesale-lenders"/);
  });

  it("keeps apiConfig off the live catalog response", () => {
    expect(submissions).toMatch(/apiConfig, \.\.\.lender/);
  });
});
