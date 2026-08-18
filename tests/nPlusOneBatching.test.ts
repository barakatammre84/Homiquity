import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Roadmap CH-2: per-row fetch loops in list routes must use the batched
// inArray house pattern (the /api/dashboard idiom in
// server/routes/lending/dashboard.ts) instead of one query per row.
//
// These are source guards in the statusVocabulary/routeGateDrift style: they
// pin the converted routes so a future edit can't quietly reintroduce a
// per-item await inside a map.
//
// CH-2's residual — per-application MISMO validation on the compliance
// dashboard — was the third loop, and it is now converted too (CTO_ROADMAP
// §3.2). Its guards are at the bottom of this file; the behavioural half, that
// the batched loader and the single-application one return IDENTICAL verdicts,
// is tests/mismoValidationBatch.test.ts. These source guards exist because
// that test is hermetic and never sees the SQL.
// ---------------------------------------------------------------------------

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("agents search enriches via one batched user fetch", () => {
  const src = read("server/routes/agent-broker/agents.ts");

  it("uses getUsersByIds for the search enrichment", () => {
    expect(src).toContain("storage.getUsersByIds");
  });

  it("has no awaited per-agent lookup inside a map callback", () => {
    // A `map(async` in this file would mean the N+1 shape came back.
    expect(src).not.toMatch(/\.map\(\s*async/);
  });
});

describe("my-referrals enriches via one batched application fetch", () => {
  const src = read("server/routes/agent-broker/referralsCoBrand.ts");

  it("uses getLoanApplicationsByUserIds", () => {
    expect(src).toContain("storage.getLoanApplicationsByUserIds");
  });

  it("no longer calls the single-user variant per referral", () => {
    expect(src).not.toContain("getLoanApplicationsByUser(");
  });
});

describe("the batched storage method preserves the single-user contract", () => {
  const src = read("server/storage/applications.ts");

  it("orders newest-first like getLoanApplicationsByUser, so apps[0] stays the latest", () => {
    const batched = src.slice(src.indexOf("getLoanApplicationsByUserIds"));
    expect(batched).toContain("desc(loanApplications.createdAt)");
    expect(batched).toContain("inArray(loanApplications.userId");
  });

  it("short-circuits an empty id list instead of issuing inArray([]) SQL", () => {
    const batched = src.slice(src.indexOf("getLoanApplicationsByUserIds"));
    expect(batched).toContain("if (userIds.length === 0) return [];");
  });
});

// ---------------------------------------------------------------------------
// CTO_ROADMAP §3.2 — the compliance dashboard's per-application MISMO
// validation. The validator makes 15 storage reads per file, so the old
// `activeApps.map(app => getApplicationValidationSummary(app.id))` cost 15N
// queries in one burst.
// ---------------------------------------------------------------------------

describe("the compliance dashboard validates in one batched load", () => {
  const src = read("server/routes/underwriting/compliance.ts");

  it("calls the batched validator", () => {
    expect(src).toContain("validateMISMOCompletenessBatch");
  });

  it("no longer calls the single-application summary per file", () => {
    expect(src).not.toContain("getApplicationValidationSummary");
  });

  it("has no awaited per-application lookup inside a map callback", () => {
    expect(src).not.toMatch(/\.map\(\s*async/);
  });
});

describe("the batched URLA read preserves the single-application contract", () => {
  const src = read("server/storage/urla.ts");
  const batched = src.slice(src.indexOf("getCompleteUrlaDataBatch"));

  it("short-circuits an empty id list instead of issuing inArray([]) SQL", () => {
    expect(batched).toContain("if (applicationIds.length === 0) return new Map();");
  });

  it("keeps each table's single-application ordering", () => {
    // personal info and declarations are ordered ASC by sequence because the
    // seq-1 row is picked as `personalInfo` / `declarations` — reverse this and
    // a co-applicant's data is scored as the primary borrower's.
    expect(batched).toContain("asc(urlaPersonalInfo.borrowerSequenceNumber)");
    expect(batched).toContain("asc(borrowerDeclarations.borrowerSequenceNumber)");
    // The list tables keep the newest-first ordering of their single-app reads.
    expect(batched).toContain("desc(employmentHistory.createdAt)");
    expect(batched).toContain("desc(otherIncomeSources.createdAt)");
    expect(batched).toContain("desc(urlaAssets.createdAt)");
    expect(batched).toContain("desc(urlaLiabilities.createdAt)");
    expect(batched).toContain("desc(realEstateOwned.createdAt)");
  });

  it("still masks the SSN before the rows leave the storage layer", () => {
    // getAllUrlaPersonalInfo applies presentUrlaPersonalInfo; the batch path
    // must too, or the dashboard load would carry SSN ciphertext out of storage.
    expect(batched).toContain("this.presentUrlaPersonalInfo(row)");
  });
});

describe("the batched validator load short-circuits and stays batched", () => {
  const src = read("server/services/mismoValidation.ts");
  const batched = src.slice(src.indexOf("export async function validateMISMOCompletenessBatch"));
  const upToNextExport = batched.slice(0, batched.indexOf("export function toValidationSummary"));

  it("issues no per-application storage read", () => {
    // Every storage call in the batch function must be a plural/batched one.
    const storageCalls = upToNextExport.match(/storage\.\w+/g) ?? [];
    expect(storageCalls.length).toBeGreaterThan(0);
    for (const call of storageCalls) {
      expect(call).toMatch(/Batch|ByApplications|ByUserIds/);
    }
  });

  it("resolves the fee schedule once for the whole batch, not per file", () => {
    expect(upToNextExport).toContain("activeFeeSchedule()");
    expect(upToNextExport.match(/activeFeeSchedule\(\)/g)).toHaveLength(1);
  });
});
