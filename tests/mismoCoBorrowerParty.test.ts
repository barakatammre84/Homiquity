// F-080 — one PARTY per borrower, and each borrower's income under their own.
//
// THE DEFECT. `PARTIES` held exactly one node built from `dto.personalInfo`,
// while `dto.employment` carried EVERY borrower's jobs. A two-borrower file
// therefore delivered both incomes under the primary borrower's name and
// taxpayer identifier — a false statement about who earns the money — and
// `validateULDDCompliance` returned `valid: true`, because a structural
// validator cannot see a schema-valid falsehood.
//
// THE AUTHORITY is in-repo, verbatim, `docs/fannie-mae/uldd-implementation-guide.pdf` p.14:
//   "Every loan delivery (DEAL container) will have a separate PARTY container
//    for each party, such as: Borrower, Appraiser, Appraiser Supervisor, Loan
//    Originator, and Loan Origination Company. The PARTY container will also be
//    repeated for multiple borrowers."
//
// WHY IT MATTERS BEYOND TIDINESS. Selling Guide A2-2-07 (p.52) makes a delivery
// data inaccuracy a LIFE-OF-LOAN representation where the delivered data
// "differ from the information documented in the lender's mortgage loan files".
// Income attributed to the wrong borrower is exactly that.
//
// `BorrowerClassificationType` is Primary | Secondary — the only two values
// MISMO_3_0.xsd permits, read out of the schema rather than recalled.
import { describe, it, expect } from "vitest";
import { generateMISMO34XML, validateULDDCompliance, type MISMOLoanDTO } from "../server/mismo";

const APP = {
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
} as any;

const JANE = { firstName: "Jane", lastName: "Doe", ssn: "111-22-3333", borrowerSequenceNumber: 1 } as any;
const MARCUS = { firstName: "Marcus", lastName: "Okafor", ssn: "444-55-6666", borrowerSequenceNumber: 2 } as any;

const JANE_JOB = { employerName: "Acme Corp", borrowerSequenceNumber: 1, monthlyIncome: "9000" } as any;
const MARCUS_JOB = { employerName: "Beltway Logistics", borrowerSequenceNumber: 2, monthlyIncome: "4000" } as any;

function dto(overrides: Partial<MISMOLoanDTO> = {}): MISMOLoanDTO {
  return {
    application: APP,
    user: { id: "user-abc123", email: "b@example.com" } as any,
    personalInfo: JANE,
    employment: [],
    assets: [],
    liabilities: [],
    propertyInfo: null,
    declarations: null,
    loanOptions: [],
    documents: [],
    ...overrides,
  };
}

/** PARTY nodes as raw strings, so each one's contents can be asserted separately. */
function parties(xml: string): string[] {
  return [...xml.matchAll(/<PARTY>([\s\S]*?)<\/PARTY>/g)].map((m) => m[1]);
}

describe("F-080 — a two-borrower file emits one PARTY per borrower", () => {
  const twoBorrowers = dto({
    allPersonalInfo: [JANE, MARCUS],
    employment: [JANE_JOB, MARCUS_JOB],
  });

  it("emits two PARTY containers, not one", () => {
    expect(parties(generateMISMO34XML(twoBorrowers))).toHaveLength(2);
  });

  it("puts each borrower's employer under that borrower's own PARTY", () => {
    const [first, second] = parties(generateMISMO34XML(twoBorrowers));

    expect(first).toContain("Jane");
    expect(first).toContain("Acme Corp");
    // The defect in one assertion: Marcus's employer must not ride under Jane.
    expect(first).not.toContain("Beltway Logistics");

    expect(second).toContain("Marcus");
    expect(second).toContain("Beltway Logistics");
    expect(second).not.toContain("Acme Corp");
  });

  it("gives each borrower their own taxpayer identifier", () => {
    const [first, second] = parties(generateMISMO34XML(twoBorrowers));
    expect(first).toContain("111223333");
    expect(first).not.toContain("444556666");
    expect(second).toContain("444556666");
    expect(second).not.toContain("111223333");
  });

  it("classifies borrower 1 Primary and borrower 2 Secondary", () => {
    const [first, second] = parties(generateMISMO34XML(twoBorrowers));
    expect(first).toContain("<BorrowerClassificationType>Primary</BorrowerClassificationType>");
    expect(second).toContain("<BorrowerClassificationType>Secondary</BorrowerClassificationType>");
  });

  it("keys off borrowerSequenceNumber, not array order", () => {
    // Same file, co-borrower listed first. Sequence decides, position does not.
    const reversed = dto({ allPersonalInfo: [MARCUS, JANE], employment: [MARCUS_JOB, JANE_JOB] });
    const [first, second] = parties(generateMISMO34XML(reversed));
    expect(first).toContain("Jane");
    expect(first).toContain("<BorrowerClassificationType>Primary</BorrowerClassificationType>");
    expect(second).toContain("Marcus");
    expect(second).toContain("<BorrowerClassificationType>Secondary</BorrowerClassificationType>");
  });
});

describe("F-080 — the single-borrower file is unchanged", () => {
  it("still emits exactly one PARTY carrying all of that borrower's employment", () => {
    const xml = generateMISMO34XML(dto({ employment: [JANE_JOB] }));
    const p = parties(xml);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("Acme Corp");
    expect(p[0]).toContain("<BorrowerClassificationType>Primary</BorrowerClassificationType>");
  });

  it("still emits a PARTY when there is no personal info at all", () => {
    // Guards the structural gate: "Missing PARTY element" must keep meaning
    // what it did, rather than becoming reachable through an empty borrower set.
    expect(parties(generateMISMO34XML(dto({ personalInfo: null })))).toHaveLength(1);
  });

  it("legacy employment rows with no sequence stay with borrower 1", () => {
    const legacyJob = { employerName: "Legacy Co", monthlyIncome: "5000" } as any;
    const p = parties(generateMISMO34XML(dto({ employment: [legacyJob] })));
    expect(p[0]).toContain("Legacy Co");
  });
});

describe("F-080 — why no existing gate caught this", () => {
  it("the structural validator passes the misattributed file either way", () => {
    // Not a complaint about validateULDDCompliance — a statement of its limit,
    // and the reason this test exists at the content level instead.
    const misattributed = dto({ allPersonalInfo: [JANE, MARCUS], employment: [JANE_JOB, MARCUS_JOB] });
    expect(validateULDDCompliance(misattributed).valid).toBe(true);
  });
});
