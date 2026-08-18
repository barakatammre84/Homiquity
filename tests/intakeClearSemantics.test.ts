import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

// Hermetic route harness — the real PATCH handler on express with a stub
// storage over an ephemeral port, the same pattern as
// tests/urlaLoanDetailsSave.test.ts.
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../server/auditLog", () => ({ logAudit: vi.fn() }));
vi.mock("../server/services/trid", () => ({
  // Set-once by design (server/services/trid.ts:167 early-returns when
  // tridTriggeredAt is set), so clearing a field can never stop a started Loan
  // Estimate clock. Stubbed here only to keep the suite off the database.
  evaluateTridTrigger: vi.fn(async () => ({ justTriggered: false, leDueDate: null })),
  tridHardStopError: vi.fn(() => null),
}));

import {
  CLEARABLE_INTAKE_FIELDS,
  isClearableIntakeField,
  loanApplicationIntakeUpdateSchema,
} from "@shared/schema";
import { mapIntakeToApplicationFields } from "../server/services/coachProfileSync";

// "Clear this field" — the third wire state, and the rules that keep it safe.
//
// `loanApplicationIntakeUpdateSchema` is `.partial()`, so ABSENT has always
// meant "leave this alone" and PRESENT has always had to satisfy the base
// rules, every one of which rejects an empty string. There was no third state,
// so a borrower who wanted a value blank again had no way to say it — and every
// surface that hit the wall dropped the edit before sending, which is how
// `/profile` came to report "Your self-reported details were saved" over an
// edit it had discarded (PR #547).
//
// `null` is now that third state. These tests pin all three, plus the two
// properties that make admitting it safe:
//
//   * a bad value is still a 400 — `null` is not a bypass;
//   * the AI coach cannot emit one, so a chat transcript can never erase a
//     borrower's answer.

const parse = (input: unknown) => loanApplicationIntakeUpdateSchema.safeParse(input);

describe("intake update — the three states of a field", () => {
  it("ABSENT means unchanged: the key does not appear in the parsed output", () => {
    const result = parse({ annualIncome: "85000" });
    expect(result.success).toBe(true);
    expect(result.success && "monthlyDebts" in result.data).toBe(false);
  });

  it("PRESENT sets the value, normalized as before", () => {
    const result = parse({ annualIncome: "85,000" });
    expect(result.success && (result.data as Record<string, unknown>).annualIncome).toBe("85000");
  });

  it("NULL clears — it survives validation and normalization untouched", () => {
    const result = parse({ annualIncome: null, monthlyDebts: null });
    expect(result.success).toBe(true);
    const data = result.success ? (result.data as Record<string, unknown>) : {};
    // Not undefined, not "", not NaN: the column gets a real SQL NULL. Running
    // stripCurrency/parseInt over it would have produced the last two.
    expect(data.annualIncome).toBeNull();
    expect(data.monthlyDebts).toBeNull();
  });

  it("null is distinguishable from absent in the parsed output", () => {
    const cleared = parse({ annualIncome: null });
    const untouched = parse({ monthlyDebts: "450" });
    expect(cleared.success && "annualIncome" in cleared.data).toBe(true);
    expect(untouched.success && "annualIncome" in untouched.data).toBe(false);
  });

  it('EMPTY STRING is still rejected — only a deliberate null erases', () => {
    // A form control emits "" on its own: a half-typed field, a controlled
    // input mounting, a sloppy JSON caller. If that erased data, every
    // accidental blank would be destructive.
    expect(parse({ annualIncome: "" }).success).toBe(false);
    expect(parse({ propertyState: "" }).success).toBe(false);
  });
});

describe("intake update — null is not a validation bypass", () => {
  it("still rejects a bad value on a clearable field", () => {
    expect(parse({ annualIncome: "abc" }).success).toBe(false);
    expect(parse({ propertyZip: "1234" }).success).toBe(false);
    expect(parse({ propertyState: "ZZ" }).success).toBe(false);
    expect(parse({ employerName: "x".repeat(201) }).success).toBe(false);
  });

  it("still runs the cross-field check when both figures are present", () => {
    expect(parse({ downPayment: "500000", purchasePrice: "400000" }).success).toBe(false);
  });

  it("skips the cross-field check when one side is cleared", () => {
    // Nothing to compare against — the same state as before either was answered.
    expect(parse({ downPayment: "500000", purchasePrice: null }).success).toBe(true);
    expect(parse({ downPayment: null, purchasePrice: "400000" }).success).toBe(true);
  });
});

describe("CLEARABLE_INTAKE_FIELDS is the catalog, and the schema agrees with it", () => {
  it("every catalogued field actually accepts null", () => {
    for (const field of CLEARABLE_INTAKE_FIELDS) {
      const result = parse({ [field]: null });
      expect(result.success, `${field} is catalogued clearable but the schema rejects null`).toBe(true);
      expect((result.success ? (result.data as Record<string, unknown>) : {})[field]).toBeNull();
    }
  });

  it("fields NOT in the catalog still reject null", () => {
    // The catalog is a decision list, not a formality: adding a name makes
    // erasure reachable from a route. These four are select-only in every UI,
    // so there is no "empty" for a borrower to produce.
    for (const field of ["creditScore", "loanPurpose", "propertyType", "employmentType"]) {
      expect(isClearableIntakeField(field)).toBe(false);
      expect(parse({ [field]: null }).success, `${field} unexpectedly accepts null`).toBe(false);
    }
  });

  it("leaves the intent booleans alone", () => {
    // `avoidsInterestFinancing` null already means "not asked", distinct from
    // an explicit no, and that distinction is set at intake. A later PATCH must
    // not be able to reach in and unset it.
    for (const field of ["isVeteran", "isFirstTimeBuyer", "avoidsInterestFinancing"]) {
      expect(isClearableIntakeField(field)).toBe(false);
      expect(parse({ [field]: null }).success, `${field} unexpectedly accepts null`).toBe(false);
    }
  });

  it("isClearableIntakeField answers for every catalogued name and nothing else", () => {
    for (const field of CLEARABLE_INTAKE_FIELDS) expect(isClearableIntakeField(field)).toBe(true);
    expect(isClearableIntakeField("softPullConsentAccepted")).toBe(false);
    expect(isClearableIntakeField("constructor")).toBe(false); // Set, not object lookup
  });
});

describe("the AI coach can never clear a borrower's answer", () => {
  // This is the property that makes admitting `null` safe at all. The coach
  // writes to the SAME schema the borrower PATCH uses, and it is fed by an LLM
  // reading a chat transcript. If a null could travel that path, a model that
  // "noticed" a field was not mentioned could erase a figure the borrower typed
  // themselves. It cannot — `presentFields` drops undefined, null and "" before
  // anything is built, and the candidate map is typed to `string | boolean` —
  // and this test is here so that stays true rather than being re-derived by
  // whoever reads the schema next and assumes null is now generally available.

  it("drops a null intake field instead of turning it into a clear", () => {
    const { applied, appliedFields } = mapIntakeToApplicationFields(
      { annualIncome: null, monthlyDebts: undefined, employerName: "" } as never,
      null,
    );
    expect(applied).toEqual({});
    expect(appliedFields).toEqual([]);
  });

  it("still applies the real values alongside them", () => {
    const { applied } = mapIntakeToApplicationFields(
      { annualIncome: null, monthlyDebts: "450" } as never,
      null,
    );
    expect(applied).toEqual({ monthlyDebts: "450" });
    expect("annualIncome" in applied).toBe(false);
  });
});

describe("PATCH /api/loan-applications/:id — a null reaches the column", () => {
  // The schema admitting null is only half of it; this is the half that proves
  // the route forwards it as a real SQL NULL rather than dropping it with the
  // undefined values.
  const h = {
    applications: [] as Record<string, any>[],
    updates: [] as { id: string; data: Record<string, unknown> }[],
  };

  const storageStub = {
    getLoanApplication: async (id: string) => h.applications.find((a) => a.id === id),
    updateLoanApplication: async (id: string, data: Record<string, unknown>) => {
      h.updates.push({ id, data });
      const app = h.applications.find((a) => a.id === id);
      if (app) Object.assign(app, data);
      return app;
    },
  } as any;

  let server: import("node:http").Server;
  let base: string;

  beforeAll(async () => {
    const express = (await import("express")).default;
    const { registerStatusDecisionRoutes } = await import("../server/routes/lending/statusDecisions");
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: "borrower-1", role: "aspiring_owner" };
      next();
    });
    registerStatusDecisionRoutes(app, storageStub);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => server?.close());

  beforeEach(() => {
    h.applications = [{
      id: "app-1",
      userId: "borrower-1",
      status: "draft",
      annualIncome: "85000",
      monthlyDebts: "450",
    }];
    h.updates = [];
  });

  const patch = (body: unknown) =>
    fetch(`${base}/api/loan-applications/app-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
      body: JSON.stringify(body),
    });

  it("writes null to the column, and leaves absent fields alone", async () => {
    const res = await patch({ monthlyDebts: null });
    expect(res.status).toBe(200);
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].data.monthlyDebts).toBeNull();
    // Untouched fields must not be swept along as nulls.
    expect("annualIncome" in h.updates[0].data).toBe(false);
  });

  it("still refuses an empty string", async () => {
    const res = await patch({ monthlyDebts: "" });
    expect(res.status).toBe(400);
    expect(h.updates).toHaveLength(0);
  });

  it("clears and sets in one request", async () => {
    const res = await patch({ monthlyDebts: null, annualIncome: "90000" });
    expect(res.status).toBe(200);
    expect(h.updates[0].data).toMatchObject({ monthlyDebts: null, annualIncome: "90000" });
  });

  it("is still draft-only — a submitted file cannot be cleared", async () => {
    h.applications[0].status = "underwriting";
    const res = await patch({ monthlyDebts: null });
    expect(res.status).toBe(409);
    expect(h.updates).toHaveLength(0);
  });
});
