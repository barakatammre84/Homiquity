import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Roadmap CH-2: per-row fetch loops in list routes must use the batched
// inArray house pattern (the /api/dashboard idiom in
// server/routes/lending/dashboard.ts) instead of one query per row.
//
// These are source guards in the statusVocabulary/routeGateDrift style: they
// pin the two converted routes so a future edit can't quietly reintroduce a
// per-item await inside a map. The third loop the ticket named (per-application
// MISMO validation on the compliance dashboard, now in
// server/routes/underwriting/compliance.ts) is deliberately NOT converted or
// guarded here — batching it means restructuring validateMISMOCompleteness's
// per-application storage reads, a compliance-sensitive refactor tracked in
// the roadmap as CH-2's residual.
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
