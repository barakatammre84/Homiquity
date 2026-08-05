import { describe, it, expect } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  detectTriggers,
  hasReviewEvidence,
  parseChangedLines,
} = require("../scripts/security-review-guard.cjs");

// -----------------------------------------------------------------------------
// The §9 security-review gate.
//
// The evidence fixtures below are the VERBATIM headings from merged PRs that did
// the review properly (#305, #328, #336, #337). They are the calibration: a guard
// that rejects a PR which actually ran the pass is worse than no guard, because the
// next author learns to route around it. House style prefixes the heading
// ("## TEAM_PRACTICES §9 security review — outcome"), so matching only a heading
// that STARTS with "Security review" would have failed two of these four.
// -----------------------------------------------------------------------------

const REAL_HEADINGS = [
  "## TEAM_PRACTICES §9 security review (binding trigger: borrower-data response shaping)",
  "## Security review (§9 — role/permission-gate trigger)",
  "## TEAM_PRACTICES §9 security review — outcome",
  "## Security review required",
];

const BODY = (heading: string, content: string) => `## Summary\n\nSomething.\n\n${heading}\n\n${content}\n`;
const REAL_CONTENT =
  "`/security-review` structured pass run on this branch: zero findings. Verified fail-closed role dispatch.";

describe("hasReviewEvidence", () => {
  it.each(REAL_HEADINGS)("accepts the real house-style heading: %s", (heading) => {
    expect(hasReviewEvidence(BODY(heading, REAL_CONTENT)).ok).toBe(true);
  });

  it("rejects a body with no security-review heading at all", () => {
    const got = hasReviewEvidence("## Summary\n\nJust a refactor.\n");
    expect(got.ok).toBe(false);
    expect(got.reason).toMatch(/no heading containing/);
  });

  it("rejects a bare heading with nothing under it — a heading is not a review", () => {
    const got = hasReviewEvidence("## Security review\n\n## Prod impact\n\nNone.\n");
    expect(got.ok).toBe(false);
    expect(got.reason).toMatch(/empty or too short/);
  });

  it("rejects a token one-liner", () => {
    expect(hasReviewEvidence("## Security review\n\nn/a\n").ok).toBe(false);
  });

  it("stops the section at the next heading, so following prose cannot pad it", () => {
    const body = "## Security review\n\nok\n\n## Verification\n\n" + "x".repeat(500);
    expect(hasReviewEvidence(body).ok).toBe(false);
  });

  it("handles a missing/empty body without throwing", () => {
    expect(hasReviewEvidence(undefined).ok).toBe(false);
    expect(hasReviewEvidence("").ok).toBe(false);
  });
});

describe("detectTriggers — §9 path triggers", () => {
  const cases: [string, string][] = [
    ["server/services/ssnVault.ts", "PII vault / field encryption"],
    ["server/services/piiVault.ts", "PII vault / field encryption"],
    ["server/services/encryptionService.ts", "PII vault / field encryption"],
    ["server/auth.ts", "auth & sessions"],
    ["server/socialAuth.ts", "auth & sessions"],
    ["server/integrations/auth/provider.ts", "auth & sessions"],
    ["server/integrations/object_storage/client.ts", "uploads / object storage"],
    ["shared/uploads.ts", "uploads / object storage"],
    ["server/services/emailService.ts", "outbound messaging"],
    ["server/services/smsCompliance.ts", "outbound messaging"],
  ];

  it.each(cases)("flags %s as %s", (file, label) => {
    const got = detectTriggers([file], []);
    expect(got.map((t: { label: string }) => t.label)).toContain(label);
  });

  it("does not flag ordinary files", () => {
    expect(detectTriggers(["client/src/pages/borrower/Documents.tsx", "README.md"], [])).toEqual([]);
  });

  it("does not flag a lookalike outside the named path", () => {
    // tests/ssnVault.test.ts is not server/services/ssnVault.ts.
    expect(detectTriggers(["tests/ssnVault.test.ts"], [])).toEqual([]);
  });

  it("reports each triggered area once, not once per file", () => {
    const got = detectTriggers(["server/auth.ts", "server/socialAuth.ts"], []);
    expect(got.filter((t: { label: string }) => t.label === "auth & sessions")).toHaveLength(1);
  });
});

describe("detectTriggers — content triggers", () => {
  it("flags an added requireRole gate in server/", () => {
    const lines = [{ file: "server/routes/lending/dashboard.ts", line: '+  requireRole("admin"),' }];
    expect(detectTriggers([], lines).map((t: { label: string }) => t.label)).toContain(
      "role/permission gates",
    );
  });

  it("flags a REMOVED gate too — deleting a check is the dangerous direction", () => {
    const lines = [{ file: "server/routes/underwriting/pipeline.ts", line: '  requireRole("closer"),' }];
    expect(detectTriggers([], lines)).toHaveLength(1);
  });

  it("flags RESPONSE_BODY_LOG_ALLOWLIST edits (PII-adjacent logging)", () => {
    const lines = [{ file: "server/app.ts", line: '  RESPONSE_BODY_LOG_ALLOWLIST.push("/api/x")' }];
    expect(detectTriggers([], lines).map((t: { label: string }) => t.label)).toContain(
      "PII-adjacent logging (RESPONSE_BODY_LOG_ALLOWLIST)",
    );
  });

  it("ignores a role-gate lookalike outside server/ (client gating is not the §9 trigger)", () => {
    const lines = [{ file: "client/src/hooks/useAuthGuard.ts", line: "  const ok = isAdmin(user);" }];
    expect(detectTriggers([], lines)).toEqual([]);
  });

  it("ignores a bare mention that is not a call", () => {
    const lines = [{ file: "server/routes/lending/index.ts", line: "// see requireRole docs" }];
    expect(detectTriggers([], lines)).toEqual([]);
  });
});

describe("parseChangedLines", () => {
  it("tags added/removed lines with their file and drops headers", () => {
    const diff = [
      "diff --git a/server/auth.ts b/server/auth.ts",
      "--- a/server/auth.ts",
      "+++ b/server/auth.ts",
      "@@ -1,0 +1,1 @@",
      '+import { requireRole } from "./roles";',
      "-const old = 1;",
    ].join("\n");
    expect(parseChangedLines(diff)).toEqual([
      { file: "server/auth.ts", line: 'import { requireRole } from "./roles";' },
      { file: "server/auth.ts", line: "const old = 1;" },
    ]);
  });

  it("survives empty/undefined input", () => {
    expect(parseChangedLines(undefined)).toEqual([]);
    expect(parseChangedLines("")).toEqual([]);
  });
});
