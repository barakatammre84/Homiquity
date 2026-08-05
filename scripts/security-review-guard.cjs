#!/usr/bin/env node
/**
 * §9 security-review guard — run by `pnpm guard:security` in ci.yml's gate job.
 *
 * TEAM_PRACTICES §9 is binding: a PR touching PII/encryption, auth/sessions, role
 * gates, uploads, outbound messaging, or PII-adjacent logging runs a security pass
 * BEFORE merge and records the outcome in the PR body. Until now nothing enforced
 * that — and nothing could, in the usual way: CODEOWNERS + "require review from code
 * owners" is the standard mechanism, but this repo has a single collaborator, GitHub
 * forbids approving your own PR, and `enforce_admins` is on. Requiring code-owner
 * review would make every §9 PR permanently unmergeable, which is exactly why
 * DB_MIGRATIONS.md records "Required reviews: none".
 *
 * So the enforceable thing for a solo owner is not a second approver — it is the
 * artifact. This fails the gate when a §9 trigger is touched and the PR body carries
 * no `## Security review` section.
 *
 * WHAT THIS DOES AND DOES NOT PROVE — read before trusting it.
 *   It proves a review was *documented*. It cannot prove the review was competent,
 *   and with one engineer nothing can. Treat a pass as "the author was made to write
 *   down what they checked", not as sign-off.
 *
 * COVERAGE. §9's triggers split into ones a diff can see and ones it cannot:
 *   detected   — the named file paths, and added/removed role-gate lines
 *                (`requireRole(` / `isAdmin(`) anywhere in server/, and any edit to
 *                RESPONSE_BODY_LOG_ALLOWLIST.
 *   NOT detected — "any shared/schema/ column holding PII" (needs to know which
 *                columns are PII) and "new PII sub-processor" (needs to know a new
 *                vendor is a processor). Both stay human judgement; §9 still binds
 *                whether or not this script fires. A green gate is not evidence that
 *                neither applies.
 *
 * Env (all supplied by ci.yml):
 *   CHANGED_FILES  newline-separated paths changed by the PR
 *   CHANGED_LINES  the PR's added/removed diff lines (git diff -U0), for the
 *                  content-based triggers
 *   PR_BODY        the pull request body
 * With CHANGED_FILES unset the guard SKIPS (exit 0) — it is PR-only by nature and
 * must never red the gate on a push build.
 */

/** §9's file-path triggers, verbatim from TEAM_PRACTICES.md §9. */
const PATH_TRIGGERS = [
  { label: "PII vault / field encryption", match: (f) => /^server\/services\/(ssnVault|piiVault|encryptionService)\.ts$/.test(f) },
  { label: "auth & sessions", match: (f) => /^server\/(auth|socialAuth)\.ts$/.test(f) || f.startsWith("server/integrations/auth/") },
  { label: "uploads / object storage", match: (f) => f.startsWith("server/integrations/object_storage/") || f === "shared/uploads.ts" },
  { label: "outbound messaging", match: (f) => /^server\/services\/(emailService|smsCompliance)\.ts$/.test(f) },
  { label: "webhook receivers", match: (f) => /^server\/routes\/.*webhook/i.test(f) },
];

/** Triggers that live in the diff's content rather than its file list. */
const LINE_TRIGGERS = [
  {
    label: "role/permission gates",
    match: (line, file) => file.startsWith("server/") && /\b(requireRole|isAdmin)\s*\(/.test(line),
  },
  {
    label: "PII-adjacent logging (RESPONSE_BODY_LOG_ALLOWLIST)",
    match: (line) => line.includes("RESPONSE_BODY_LOG_ALLOWLIST"),
  },
];

/**
 * Which §9 areas this PR touches.
 *
 * @param {string[]} files          changed paths
 * @param {{file:string, line:string}[]} changedLines  added/removed diff lines
 * @returns {{label:string, evidence:string}[]} deduped, one per triggered area
 */
function detectTriggers(files, changedLines) {
  const hits = new Map();

  for (const f of files) {
    for (const t of PATH_TRIGGERS) {
      if (t.match(f) && !hits.has(t.label)) hits.set(t.label, f);
    }
  }
  for (const { file, line } of changedLines) {
    for (const t of LINE_TRIGGERS) {
      if (t.match(line, file) && !hits.has(t.label)) hits.set(t.label, `${file}: ${line.trim().slice(0, 80)}`);
    }
  }

  return [...hits].map(([label, evidence]) => ({ label, evidence }));
}

/** Minimum substantive characters under the heading — a bare heading is not a review. */
const MIN_EVIDENCE_CHARS = 40;

/**
 * Does the PR body carry a real `## Security review` section?
 *
 * @param {string} body
 * @returns {{ok:boolean, reason:string}}
 */
function hasReviewEvidence(body) {
  const text = String(body || "");
  const lines = text.split("\n");
  // Any heading CONTAINING "security review" counts — the house style prefixes it
  // (`## TEAM_PRACTICES §9 security review — outcome`, `## Security review (§9 …)`),
  // and a guard that only matched a heading STARTING with it would fail PRs that did
  // the review properly. Calibrated against the real bodies of #305/#328/#336/#337.
  const headingIdx = lines.findIndex((l) => /^#{1,6}\s+.*security[\s-]*review/i.test(l.trim()));
  if (headingIdx === -1) {
    return { ok: false, reason: "no heading containing `Security review` in the PR body" };
  }

  const section = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break; // next heading ends the section
    section.push(lines[i]);
  }
  const substantive = section.join(" ").replace(/\s+/g, " ").trim();
  if (substantive.length < MIN_EVIDENCE_CHARS) {
    return {
      ok: false,
      reason: `the \`Security review\` section is empty or too short (${substantive.length} chars, need ${MIN_EVIDENCE_CHARS})`,
    };
  }
  return { ok: true, reason: "" };
}

/** `git diff -U0` output -> the added/removed lines, tagged with their file. */
function parseChangedLines(diff) {
  const out = [];
  let file = "";
  for (const line of String(diff || "").split("\n")) {
    const m = /^\+\+\+ b\/(.+)$/.exec(line);
    if (m) {
      file = m[1];
      continue;
    }
    if (/^(\+\+\+|---)/.test(line)) continue;
    if (/^[+-]/.test(line) && file) out.push({ file, line: line.slice(1) });
  }
  return out;
}

function main() {
  const rawFiles = process.env.CHANGED_FILES;
  if (rawFiles === undefined) {
    console.log("security-review-guard: CHANGED_FILES unset (not a PR build) — skipping.");
    return;
  }

  const files = rawFiles.split("\n").map((s) => s.trim()).filter(Boolean);
  const changedLines = parseChangedLines(process.env.CHANGED_LINES);
  const triggers = detectTriggers(files, changedLines);

  if (triggers.length === 0) {
    console.log("security-review-guard: OK — no §9 trigger touched by this PR.");
    return;
  }

  const evidence = hasReviewEvidence(process.env.PR_BODY);
  if (evidence.ok) {
    console.log(
      `security-review-guard: OK — ${triggers.length} §9 trigger(s) touched ` +
        `(${triggers.map((t) => t.label).join("; ")}) and the PR body records a security review.`,
    );
    return;
  }

  console.error("security-review-guard: FAIL — this PR touches a TEAM_PRACTICES §9 trigger:\n");
  for (const t of triggers) console.error(`  • ${t.label}\n      ${t.evidence}`);
  console.error(
    `\n${evidence.reason}.\n` +
      "\n§9 is binding: run `/security-review` (or an equivalent structured pass) and record\n" +
      "the outcome in the PR body under a `## Security review` heading — what you checked and\n" +
      "what you found, including 'no findings'. Unresolved CRITICAL findings block the merge.\n" +
      "\nThis check verifies the review was WRITTEN DOWN, not that it was correct. It also does\n" +
      "not detect two §9 triggers at all — a shared/schema/ column holding PII, and a new PII\n" +
      "sub-processor — so a green gate never means §9 is satisfied on those.\n" +
      "See knowledge-base/governance/TEAM_PRACTICES.md §9.",
  );
  process.exit(1);
}

module.exports = { detectTriggers, hasReviewEvidence, parseChangedLines };

if (require.main === module) main();
