// ONE readiness number.
//
// Three models answered "how ready are you": the readiness_checklist (25
// weighted fields with trust tiers), the coach's conversational percentage, and
// an ad-hoc status-plus-bonuses calculation in borrowerGraph. Only the coach's
// ever reached a borrower, and they could disagree freely.
//
// The checklist could not be made primary because NOTHING FED IT FROM THE
// APPLICATION — only the document paths wrote to it, so a borrower who had
// stated income, employer, credit score and property still scored near zero on
// the model that knew the most. shared/readinessMapping.ts is that missing
// feed; these pin its rules.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { readinessAssertionsFromApplication } from "../shared/readinessMapping";

const FULL_APP = {
  annualIncome: "120000",
  monthlyDebts: "850",
  creditScore: 742,
  employmentType: "w2",
  employmentYears: 6,
  employerName: "Acme Corp",
  propertyAddress: "1 Main St",
  propertyType: "single_family",
  propertyState: "IL",
  purchasePrice: "400000",
  downPayment: "80000",
  occupancyType: "primary",
};

const fields = (app: any) => readinessAssertionsFromApplication(app).map(a => a.fieldName);

describe("application → readiness assertions", () => {
  it("records what the application actually says", () => {
    expect(fields(FULL_APP)).toEqual(
      expect.arrayContaining([
        "annual_income", "employment_type", "employer_name", "employment_duration",
        "monthly_debts", "credit_score", "down_payment_source",
        "property_type", "property_address", "purchase_price", "occupancy_type",
      ]),
    );
  });

  it("asserts everything at application_stated — tier 2, never document grade", () => {
    // The application is the borrower's word. A document upgrades the same row
    // to tier 1; this must never claim that on its own.
    for (const a of readinessAssertionsFromApplication(FULL_APP)) {
      expect(a.status).toBe("application_stated");
    }
  });

  it("records nothing for an empty draft rather than inflating the score", () => {
    expect(readinessAssertionsFromApplication({})).toEqual([]);
  });

  it("treats a declared zero debt as an answer, but a zero income as not one", () => {
    // "I have no monthly debts" is information. An income of 0 is a blank field.
    expect(fields({ monthlyDebts: "0" })).toContain("monthly_debts");
    expect(fields({ annualIncome: "0" })).not.toContain("annual_income");
  });

  it("treats zero years at a job as an answer — a new job is a real answer", () => {
    expect(fields({ employmentYears: 0 })).toContain("employment_duration");
    expect(fields({ employmentYears: null })).not.toContain("employment_duration");
  });

  it("ignores blank and whitespace-only text answers", () => {
    expect(fields({ employerName: "   ", propertyType: "" })).toEqual([]);
  });

  it("does NOT claim identity, declarations or consent from an application", () => {
    // Those live on other records (URLA declarations, consent rows). Claiming
    // them here would inflate the one number the borrower is about to be shown.
    const claimed = fields(FULL_APP);
    for (const foreign of [
      "full_name", "date_of_birth", "ssn", "citizenship_status", "marital_status",
      "bankruptcy_declaration", "foreclosure_declaration", "ownership_interest",
      "credit_pull_consent", "econsent",
    ]) {
      expect(claimed).not.toContain(foreign);
    }
  });

  it("does not claim total_assets from a down payment figure", () => {
    // A down payment is a plan, not a balance. total_assets stays a
    // document/Plaid fact.
    expect(fields(FULL_APP)).not.toContain("total_assets");
    expect(fields(FULL_APP)).toContain("down_payment_source");
  });

  it("is deterministic", () => {
    expect(readinessAssertionsFromApplication(FULL_APP)).toEqual(
      readinessAssertionsFromApplication(FULL_APP),
    );
  });
});

describe("the graph resolves ONE readiness source, in priority order", () => {
  const graphSrc = readFileSync(
    resolve(__dirname, "..", "server/services/borrowerGraph.ts"),
    "utf8",
  );

  it("prefers the checklist when it has rows", () => {
    expect(graphSrc).toMatch(/checklistScore\s*=\s*checklistRows\.length > 0/);
    expect(graphSrc).toMatch(/readiness\.source = "checklist"/);
  });

  it("keeps coach and calculated as ordered fallbacks, not parallel answers", () => {
    const block = graphSrc.slice(graphSrc.indexOf("const checklistScore"));
    const checklistAt = block.indexOf('readiness.source = "checklist"');
    const coachAt = block.indexOf('readiness.source = "coach"');
    expect(checklistAt).toBeGreaterThan(-1);
    expect(coachAt).toBeGreaterThan(checklistAt);
    // The coach branch must be an `else if`, so only one model ever answers.
    expect(block).toMatch(/\}\s*else if \(coachConvWithProfile\)/);
  });

  it("builds outstandingInputs from required-but-missing field labels", () => {
    // The reason the checklist wins: it knows WHAT is missing, not just how
    // far along the file is.
    expect(graphSrc).toMatch(/else if \(row\.isRequired\)\s*\{\s*outstanding\.push\(row\.fieldLabel\)/);
  });

  it("is wired at application creation, so the checklist is not starved", () => {
    const routeSrc = readFileSync(
      resolve(__dirname, "..", "server/routes/lending/applications.ts"),
      "utf8",
    );
    expect(routeSrc).toMatch(/syncApplicationToReadiness\(userId, application\.id, application\)/);
  });
});
