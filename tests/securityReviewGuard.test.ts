import { describe, it, expect } from "vitest";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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
    ["server/routes/webhooks.ts", "webhook receivers & signature verification"],
    // Added 2026-08-06. Each of these was UNCOVERED until the post-Railway audit; the
    // cases exist so a future edit to PATH_TRIGGERS cannot silently drop them again.
    ["server/services/accountRecovery.ts", "auth & sessions"],
    ["server/services/twilioSignature.ts", "webhook receivers & signature verification"],
    ["server/services/twilioMessageStatus.ts", "webhook receivers & signature verification"],
    ["server/clientIp.ts", "request identity & trust boundary"],
    ["server/trustProxy.ts", "request identity & trust boundary"],
    ["server/services/rateLimitPolicy.ts", "rate-limit policy"],
  ];

  it.each(cases)("flags %s as %s", (file, label) => {
    const got = detectTriggers([file], []);
    expect(got.map((t: { label: string }) => t.label)).toContain(label);
  });

  // The bug this trigger was widened to catch: routes/webhooks.ts only CALLS
  // evaluateTwilioWebhookAuth. With the route covered but the delegate not, a PR could
  // weaken the signature check — the actual auth boundary — and pass the gate. #433 was
  // that class of bug (the inbound SMS webhook trusted anyone who found the URL).
  it("flags the signature-verification delegate on its own, not just the route that calls it", () => {
    expect(detectTriggers(["server/services/twilioSignature.ts"], [])).toHaveLength(1);
  });

  // clientIp.ts is §9 because of its consumers: rateLimitKey (abuse control) and
  // clientIpForRecord, which lands in every audit row and in leads.ts's `consentIp` —
  // the TCPA consent provenance. Changing it alone must still demand a review.
  it("flags request-identity resolution even when nothing else in the PR is a trigger", () => {
    const got = detectTriggers(["server/clientIp.ts", "README.md", "client/src/pages/borrower/Tasks.tsx"], []);
    expect(got.map((t: { label: string }) => t.label)).toEqual(["request identity & trust boundary"]);
  });

  it("does not flag ordinary files", () => {
    expect(detectTriggers(["client/src/pages/borrower/Documents.tsx", "README.md"], [])).toEqual([]);
  });

  it("does not flag a lookalike outside the named path", () => {
    // tests/ssnVault.test.ts is not server/services/ssnVault.ts. tests/clientIp.test.ts
    // is a real file in this repo, so the new trigger's anchoring is load-bearing: an
    // unanchored /clientIp/ would red every PR that merely touches its test.
    expect(detectTriggers(["tests/ssnVault.test.ts", "tests/clientIp.test.ts"], [])).toEqual([]);
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

  it("flags RESPONSE_BODY_LOG_ALLOWLIST edits in server/app.ts (PII-adjacent logging)", () => {
    const lines = [{ file: "server/app.ts", line: '  RESPONSE_BODY_LOG_ALLOWLIST.push("/api/x")' }];
    expect(detectTriggers([], lines).map((t: { label: string }) => t.label)).toContain(
      "PII-adjacent logging (RESPONSE_BODY_LOG_ALLOWLIST)",
    );
  });

  it("does NOT flag merely NAMING the allowlist outside server/app.ts", () => {
    // §9 scopes this trigger to server/app.ts. Unscoped, the guard flagged its own
    // source and tests for containing the word — a live false positive on its own PR.
    const lines = [
      { file: "scripts/security-review-guard.cjs", line: " *   RESPONSE_BODY_LOG_ALLOWLIST in server/app.ts" },
      { file: "tests/securityReviewGuard.test.ts", line: '  line: "RESPONSE_BODY_LOG_ALLOWLIST"' },
      { file: "knowledge-base/governance/TEAM_PRACTICES.md", line: "widening of RESPONSE_BODY_LOG_ALLOWLIST" },
    ];
    expect(detectTriggers([], lines)).toEqual([]);
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

// -----------------------------------------------------------------------------
// The observable-pass property, exercised through the CLI because it lives in
// main(): a guard whose pass looks identical whether it inspected the diff or
// never saw it is the failure mode that let vercel-deployment-guard sit inert.
// -----------------------------------------------------------------------------
describe("CLI: empty vs unset CHANGED_FILES", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execFileSync } = require("child_process");
  const run = (env: Record<string, string | undefined>) => {
    try {
      const stdout = execFileSync("node", ["scripts/security-review-guard.cjs"], {
        env: { ...process.env, CHANGED_FILES: undefined, CHANGED_LINES: undefined, PR_BODY: undefined, ...env },
        encoding: "utf8",
      });
      return { code: 0, out: stdout };
    } catch (e: any) {
      return { code: e.status, out: `${e.stdout || ""}${e.stderr || ""}` };
    }
  };

  it("SKIPS when CHANGED_FILES is unset — not a PR build, must not red the gate", () => {
    const got = run({});
    expect(got.code).toBe(0);
    expect(got.out).toMatch(/skipping/i);
  });

  it("FAILS when CHANGED_FILES is set but empty — the diff did not compute", () => {
    const got = run({ CHANGED_FILES: "" });
    expect(got.code).toBe(1);
    expect(got.out).toMatch(/CHANGED_FILES is empty/);
  });

  it("reports the file count on a clean pass, so the log proves it saw the diff", () => {
    const got = run({ CHANGED_FILES: "README.md\npackage.json" });
    expect(got.code).toBe(0);
    expect(got.out).toMatch(/no §9 trigger among 2 changed file\(s\)/);
  });

  // A `git diff -U0` bigger than Linux's MAX_ARG_STRLEN (131,072 bytes — the
  // per-STRING environment cap) makes execve fail with E2BIG, so the step dies as
  // "pnpm: Argument list too long" and the guard never runs. That surfaced on a
  // real PR at 137,761 bytes: a misleading infra failure reported AFTER every
  // substantive check in the gate had already passed. ci.yml now hands both inputs
  // over as files; these pin that path so the fix cannot silently regress.
  describe("oversized diffs arrive via *_FILE instead of the environment", () => {
    const tmp = (name: string, body: string) => {
      const p = join(tmpdir(), `secguard-${process.pid}-${name}`);
      writeFileSync(p, body);
      return p;
    };

    it("reads CHANGED_FILES_FILE, including past the env per-string limit", () => {
      // 200k of padding — comfortably over MAX_ARG_STRLEN, so this content could
      // not have been passed inline at all.
      const padding = Array.from({ length: 4000 }, (_, i) => `docs/pad-${i}.md`).join("\n");
      const got = run({
        CHANGED_FILES_FILE: tmp("files.txt", `README.md\n${padding}`),
      });
      expect(got.code).toBe(0);
      expect(got.out).toMatch(/no §9 trigger among 4001 changed file\(s\)/);
    });

    it("reads CHANGED_LINES_FILE and still detects a content trigger inside a huge diff", () => {
      const bulk = Array.from({ length: 6000 }, (_, i) => `+ // filler line ${i}`).join("\n");
      // A real `git diff -U0` payload: the `+++ b/<file>` header is what attributes
      // the following lines to a file, so the fixture must carry one.
      const diff = [
        "diff --git a/server/routes/thing.ts b/server/routes/thing.ts",
        "--- a/server/routes/thing.ts",
        "+++ b/server/routes/thing.ts",
        bulk,
        '+  requireRole("admin")',
        bulk,
      ].join("\n");
      const got = run({
        CHANGED_FILES_FILE: tmp("files2.txt", "server/routes/thing.ts"),
        CHANGED_LINES_FILE: tmp("lines2.diff", diff),
        PR_BODY: "",
      });
      // The role-gate trigger must still fire from deep inside the payload, and with
      // no `## Security review` section the gate must go red.
      expect(got.code).toBe(1);
      expect(got.out).toMatch(/§9 trigger/);
    });

    it("prefers the file over an inline var when both are present", () => {
      const got = run({
        CHANGED_FILES: "server/auth.ts",
        CHANGED_FILES_FILE: tmp("files3.txt", "README.md"),
      });
      // server/auth.ts would trigger; README.md does not. The file must win.
      expect(got.code).toBe(0);
      expect(got.out).toMatch(/no §9 trigger among 1 changed file\(s\)/);
    });
  });
});
