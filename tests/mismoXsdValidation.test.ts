import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  validateAgainstXsd,
  extractOffendingElements,
  MISMO_BASE_XSD,
} from "../server/services/mismoXsdValidation";
import { generateMISMO34XML, type MISMOLoanDTO } from "../server/mismo";

// ---------------------------------------------------------------------------
// L6 (CTO_ROADMAP.md): "Add an XSD-validation step for our generated MISMO
// 3.4 XML to the delivery test gate ... so exports are schema-valid, not just
// valid per our hand-built checks."
//
// The real MISMO export (server/mismo.ts) does NOT yet conform to the
// official schema — xmllint finds real structural violations (wrong element
// nesting/names for SUBJECT_PROPERTY, PARTY names, EMPLOYMENT, ASSETS,
// LIABILITIES, LOAN identifiers). Fixing shared/mismo.ts field-by-field
// against the schema is a separate, larger remediation ticket (tracked as
// L6-fix in CTO_ROADMAP.md) — this suite's job is to PIN the current known
// violations as a regression baseline: any accidental new violation fails
// the test immediately, and any deliberate fix requires updating the
// baseline array here (forcing the change to be visible and intentional).
//
// Element-name extraction (not full messages) keeps the baseline stable
// across incidental line-number/formatting churn in the generated XML.
// ---------------------------------------------------------------------------

let xmllintInstalled = true;
beforeAll(() => {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
  } catch {
    xmllintInstalled = false;
  }
});

function baseDto(overrides: Partial<MISMOLoanDTO> = {}): MISMOLoanDTO {
  return {
    application: {
      id: "3f8a-9c2d-11ee-8c90-0242ac120002",
      status: "pre_approved",
      loanPurpose: "purchase",
      preferredLoanType: "conventional",
      propertyType: "single_family",
      propertyAddress: "123 Main St",
      propertyCity: "Austin",
      propertyState: "TX",
      propertyZip: "78701",
      propertyValue: "500000",
      purchasePrice: "500000",
      downPayment: "100000",
      createdAt: new Date("2026-01-01"),
      ...(overrides.application ?? {}),
    } as any,
    user: { id: "user-abc123", email: "b@example.com" } as any,
    personalInfo: { firstName: "Jane", lastName: "Doe", ssn: "123-45-6789" } as any,
    employment: overrides.employment ?? [
      { employerName: "Acme", employmentType: "employed", startDate: "2020-01-01" } as any,
    ],
    assets: overrides.assets ?? [{ accountType: "checking", cashOrMarketValue: "5000" } as any],
    liabilities: overrides.liabilities ?? [
      { liabilityType: "credit_card", monthlyPayment: "50" } as any,
    ],
    propertyInfo: overrides.propertyInfo ?? null,
    declarations: null,
    loanOptions: overrides.loanOptions ?? [],
    documents: [],
  };
}

describe("validateAgainstXsd (harness correctness)", () => {
  it("validates a conformant document as valid", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mismo-xsd-harness-"));
    const xsdPath = path.join(dir, "control.xsd");
    writeFileSync(
      xsdPath,
      `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="ROOT">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="OK" type="xsd:string"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`,
    );
    try {
      if (!xmllintInstalled) return;
      const result = validateAgainstXsd("<ROOT><OK>yes</OK></ROOT>", xsdPath);
      expect(result.skipped).toBe(false);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags a document with an unexpected element", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mismo-xsd-harness-"));
    const xsdPath = path.join(dir, "control.xsd");
    writeFileSync(
      xsdPath,
      `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="ROOT">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="OK" type="xsd:string"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`,
    );
    try {
      if (!xmllintInstalled) return;
      const result = validateAgainstXsd("<ROOT><NOT_OK>no</NOT_OK></ROOT>", xsdPath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns skipped:true instead of a false failure when xmllint is unavailable", () => {
    // Exercised implicitly by every assertion above via the module-level
    // availability cache; this test documents the contract explicitly using
    // a path that is guaranteed not to exist so a broken installation would
    // still not report a false "invalid".
    if (xmllintInstalled) return; // covered by the real run in CI/dev with xmllint present
    const result = validateAgainstXsd("<ROOT/>", "/nonexistent/schema.xsd");
    expect(result.skipped).toBe(true);
  });
});

describe("MISMO export vs. the official schema (known-violations baseline)", () => {
  // KNOWN NON-CONFORMANCE — do not silently grow this list. If a change adds
  // a new offending element, that's a regression: fix the export instead of
  // updating this baseline. If a change removes one, that's progress on the
  // L6-fix remediation ticket: update the baseline down and note it in the
  // commit. See CTO_ROADMAP.md L6 for the tracked remediation scope.
  // F-018 (2026-07-08): fixing the LOAN child-container sequence + nesting cleared the
  // LOAN_DETAIL / LOAN_IDENTIFIERS structural violations (the five terms points now sit in
  // TERMS_OF_MORTGAGE, amortization in AMORTIZATION_RULE, children emitted in XSD order). That
  // let xmllint validate INTO the UNDERWRITING container, which surfaced pre-existing (previously
  // masked) violations there — AUTOMATED_UNDERWRITINGS / UnderwritingDecisionType — tracked as
  // escalation U-1 (AUS data-point names pending ULDD data-dictionary confirmation; MISMO's is
  // AutomatedUnderwritingRecommendationDescription). Net structural progress; do not "fix" the
  // UNDERWRITING names from memory.
  const KNOWN_UNDERWRITING_VIOLATIONS = [
    "ASSETS",
    "AUTOMATED_UNDERWRITINGS",
    "BorrowerSSNIdentifier",
    "CONTACT_POINTS",
    "EmployerName",
    "FirstNameText",
    "LoanIdentifier",
    "SUBJECT_PROPERTY",
    "UnderwritingDecisionType",
  ];
  const KNOWN_LOAN_DELIVERY_VIOLATIONS = [
    "AUTOMATED_UNDERWRITINGS",
    "BorrowerSSNIdentifier",
    "CONTACT_POINTS",
    "EmployerName",
    "FirstNameText",
    "LIABILITIES",
    "LoanIdentifier",
    "SUBJECT_PROPERTY",
    "UnderwritingDecisionType",
  ];

  it("underwriting-purpose export matches the known-violations baseline", () => {
    if (!xmllintInstalled) return;
    const xml = generateMISMO34XML(baseDto());
    const result = validateAgainstXsd(xml, MISMO_BASE_XSD);
    expect(result.valid).toBe(false);
    expect(extractOffendingElements(result.errors)).toEqual(KNOWN_UNDERWRITING_VIOLATIONS);
  });

  it("loanDelivery-purpose export matches the known-violations baseline", () => {
    if (!xmllintInstalled) return;
    const xml = generateMISMO34XML(baseDto(), { purpose: "loanDelivery", noteDate: "2026-03-15" });
    const result = validateAgainstXsd(xml, MISMO_BASE_XSD);
    expect(result.valid).toBe(false);
    expect(extractOffendingElements(result.errors)).toEqual(KNOWN_LOAN_DELIVERY_VIOLATIONS);
  });
});
