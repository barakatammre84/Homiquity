#!/usr/bin/env node
/**
 * Selling Guide authority guard — run by `pnpm guard:authority` in ci.yml's gate job.
 *
 * The Selling Guide is the policy authority for eligibility, underwriting, income,
 * credit, property and delivery (CLAUDE.md; TEAM_PRACTICES §10). Homiquity is a
 * third-party originator in the Guide's own vocabulary (A3-3-01), so a wholesale
 * lender's QC is contractually required to sample our files (D1-1-01) — the Guide is
 * the standard a counterparty measures us against, not merely a reference shelf.
 *
 * This fails the gate when a PR changes Guide-governed logic without naming the
 * section that governs it, and when any added line cites a section that does not
 * exist in the committed edition.
 *
 * WHAT THIS PROVES AND DOES NOT PROVE — read before trusting it.
 *   It proves a citation was WRITTEN DOWN and that the id RESOLVES. It cannot prove
 *   the cited section actually says what the code claims. A resolving id is a
 *   pointer, not a verification. Treat a pass as "the author was made to name the
 *   governing section", never as sign-off on the reading.
 *
 * WHY THE UNKNOWN-ID CHECK EARNS ITS KEEP. The Guide renumbers between editions.
 *   On 2026-03-04 self-employment income moved off B3-3.2/B3-3.4, and six code sites
 *   kept citing the old chapter — undetected, because the stale URL did not 404: it
 *   returned HTTP 200 and silently resolved to the renumbered page. An id checked
 *   against the committed section index cannot fail that way.
 *
 * COVERAGE. A floor, not a ceiling:
 *   detected     — changed files under PATH_TRIGGERS; any unresolvable section id on
 *                  an added line, anywhere in the diff, including docs.
 *   NOT detected — whether the reading is correct; policy logic living outside the
 *                  trigger paths; a correct id cited for the wrong rule. A green
 *                  guard is not a clean bill of health.
 *
 * TABLES. The committed text extraction flattens tables — ruled ones survive,
 *   borderless ones do not (B2-2-03's financed-property limits table is the known
 *   case). A threshold, matrix cell or limit read out of a table is not verified
 *   until confirmed against the PDF page. This script cannot enforce that; it is
 *   stated here because this is where people come looking.
 *
 * Env (all supplied by ci.yml, same contract as security-review-guard.cjs):
 *   CHANGED_FILES / CHANGED_FILES_FILE   newline-separated changed paths
 *   CHANGED_LINES / CHANGED_LINES_FILE   `git diff -U0` output
 *   PR_BODY                              the pull request body
 * The *_FILE forms exist because `git diff -U0` on a large PR exceeds Linux's
 * MAX_ARG_STRLEN and kills the step before the script runs.
 */

const fs = require("fs");
const path = require("path");

const SECTION_INDEX = path.join(
  __dirname,
  "..",
  "docs",
  "fannie-mae",
  "selling-guide",
  "section-index.tsv",
);

const MIN_EVIDENCE_CHARS = 40;

/**
 * Rationale required BEYOND the attestation sentence. Measured on the remainder,
 * because the sentence is 43 characters — long enough to clear a naive length check
 * all by itself, which would make the attestation a one-line bypass.
 */
const MIN_RATIONALE_CHARS = 20;

/** The exact sentence that records "this diff asserts no policy". Deliberately rigid. */
const ATTESTATION = "No Selling Guide policy asserted or altered";

/**
 * A Selling Guide section id: B3-6-05, B3-5.3-09, A2-2-04, E-2-04, C3-6-01.
 * The lookbehind/lookahead keep it from firing inside longer tokens (dates, versions,
 * `MISMO-E-2-04`-shaped strings).
 */
const SG_ID = /(?<![A-Za-z0-9.\-])([A-E]\d{0,2}-\d(?:\.\d+)?-\d{2})(?![\d.])/g;

/**
 * Lines that deliberately name a dead id — reorg commentary, supersession notes,
 * findings write-ups. Without this the guard would forbid writing accurate history.
 */
const HISTORICAL_MARKER = /formerly|renumber|superseded|historical|was\s+[A-E]\d{0,2}-\d/i;

/**
 * Paths whose logic traces to the Guide. Mirrored in TEAM_PRACTICES §10 — the register
 * and this array are edited in the same PR, the way §9 and security-review-guard are.
 */
const PATH_TRIGGERS = [
  {
    label: "underwriting & decision engines",
    paths: [
      "server/underwritingEngine.ts",
      "server/underwriting.ts",
      "server/services/decisionEngine.ts",
      "server/services/ruleEngine.ts",
      "server/services/preUnderwriting.ts",
      "server/services/underwritingNuance.ts",
    ],
  },
  {
    label: "income policy",
    paths: [
      "server/services/selfEmploymentIncome.ts",
      "server/services/income/",
      "server/services/worksheetPrefill.ts",
      "shared/incomePaths.ts",
      "shared/taxFormExtraction.ts",
      "shared/borrowerIncomeView.ts",
    ],
  },
  {
    label: "scenario & classification",
    paths: [
      "server/services/scenarioCatalog.ts",
      "server/services/situationClassifier.ts",
      "server/services/loanAnalysis.ts",
    ],
  },
  {
    label: "AUS / DU",
    paths: ["server/services/ausSubmission.ts", "server/routes/aus.ts"],
  },
  {
    label: "delivery & submission readiness",
    paths: [
      "server/services/loanDeliveryReadiness.ts",
      "server/services/brokerSubmissionReadiness.ts",
      "server/services/lenderSubmission.ts",
      "server/services/mismoValidation.ts",
      "server/mismo.ts",
      "shared/mismo.ts",
    ],
  },
  {
    label: "policy data & schema",
    paths: ["server/scripts/seedLendingGrids.ts", "shared/schema/lendingUrla.ts"],
  },
  {
    label: "borrower-facing policy surfaces",
    paths: ["server/services/autopilot/followUps.ts"],
  },
];

/*
 * DELIBERATELY EXCLUDED — do not add these without reading why they are out.
 *
 *   shared/fannieMae/**  — job-aid-sourced delivery FORMATS (ULDD/UCD enumerations,
 *     edit codes, SFCs). Their authority is the job aids in docs/fannie-mae/ plus the
 *     §5.5 ledger rule; the Guide is the policy layer above them. Dual-gating would
 *     teach people to paste Guide ids onto job-aid data, which is worse than no cite.
 *
 *   server/pricing.ts    — LLPA authority is the LLPA Matrix, which is NOT procured
 *     (docs/fannie-mae/README.md's procurement list). A trigger nobody can satisfy
 *     honestly is a trap that trains route-arounds. Add it when the Matrix lands.
 */

/** Leaf section ids from the committed edition. Returns null when the corpus is absent. */
function loadSectionIndex(file = SECTION_INDEX) {
  if (!fs.existsSync(file)) return null;
  const ids = new Set();
  for (const row of fs.readFileSync(file, "utf8").split("\n")) {
    const cols = row.split("\t");
    if (cols.length < 3) continue;
    const m = /^([A-E]\d{0,2}-\d(?:\.\d+)?-\d{2}),/.exec(cols[2].trim());
    if (m) ids.add(m[1]);
  }
  return ids.size ? ids : null;
}

function detectTriggers(files) {
  const hit = [];
  for (const t of PATH_TRIGGERS) {
    const matched = files.filter((f) => t.paths.some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p)));
    if (matched.length) hit.push({ label: t.label, files: matched });
  }
  return hit;
}

/** Every section id on an ADDED line, minus lines flagged as deliberate history. */
function findCitations(changedLines) {
  const out = [];
  for (const entry of changedLines) {
    if (!entry.added) continue;
    if (HISTORICAL_MARKER.test(entry.line)) continue;
    for (const m of entry.line.matchAll(SG_ID)) {
      out.push({ id: m[1], file: entry.file, line: entry.line.trim() });
    }
  }
  return out;
}

function resolveIds(citations, index) {
  const known = [];
  const unknown = [];
  for (const c of citations) (index.has(c.id) ? known : unknown).push(c);
  return { known, unknown };
}

/**
 * A `## Selling Guide authority` PR-body section, carrying either a resolving id or
 * the attestation. The attestation is a RECORDED CLAIM, not a waiver — it is in the
 * PR record with the author's name on it, which is the only enforceable thing for a
 * solo owner (same reasoning as §9's).
 */
function hasAuthorityEvidence(body, index) {
  const lines = String(body || "").split("\n");
  const idx = lines.findIndex((l) => /^#{1,6}\s+.*selling[\s-]*guide[\s-]*authority/i.test(l.trim()));
  if (idx === -1) {
    return { ok: false, reason: "no heading containing `Selling Guide authority` in the PR body" };
  }
  const section = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) break;
    section.push(lines[i]);
  }
  const text = section.join(" ").replace(/\s+/g, " ").trim();

  const ids = [...text.matchAll(SG_ID)].map((m) => m[1]);
  const bad = ids.filter((id) => !index.has(id));
  if (bad.length) {
    return { ok: false, reason: `cites ${bad.join(", ")}, which the committed edition does not contain` };
  }
  if (ids.length) return { ok: true, reason: "" };

  if (text.includes(ATTESTATION)) {
    const rationale = text.replace(ATTESTATION, " ").replace(/[\s\-—:.]+/g, " ").trim();
    if (rationale.length < MIN_RATIONALE_CHARS) {
      return {
        ok: false,
        reason:
          `the attestation needs a line of rationale beyond the sentence itself ` +
          `(${rationale.length} chars, need ${MIN_RATIONALE_CHARS})`,
      };
    }
    return { ok: true, reason: "" };
  }
  return { ok: false, reason: "the section names no resolving section id and carries no attestation" };
}

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
    if (/^[+-]/.test(line) && file) out.push({ file, line: line.slice(1), added: line[0] === "+" });
  }
  return out;
}

function main() {
  const readInput = (name) => {
    const filePath = process.env[`${name}_FILE`];
    if (filePath) return fs.readFileSync(filePath, "utf8");
    return process.env[name];
  };

  const rawFiles = readInput("CHANGED_FILES");
  if (rawFiles === undefined) {
    console.log("selling-guide-authority-guard: CHANGED_FILES unset (not a PR build) — skipping.");
    return;
  }
  const files = rawFiles.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!files.length) {
    console.error(
      "selling-guide-authority-guard: FAIL — CHANGED_FILES is set but empty. A real PR always\n" +
        "changes at least one file, so this is a broken invocation (wrong shas, shallow clone),\n" +
        "not a clean result. Fix the diff computation in ci.yml rather than trusting this run.",
    );
    process.exit(1);
  }

  const index = loadSectionIndex();
  if (!index) {
    // Loud on purpose. A guard that silently does nothing is the defect class this
    // repo calls silent-success, so say plainly that it is inert and why.
    console.log(
      "selling-guide-authority-guard: INERT — no docs/fannie-mae/selling-guide/section-index.tsv.\n" +
        "  The Guide corpus has not landed on this branch, so no citation can be resolved and\n" +
        "  nothing is enforced. This guard arms itself automatically once the corpus is present.\n" +
        "  If you expected it to be armed, the corpus PR has not merged yet.",
    );
    return;
  }

  const changedLines = parseChangedLines(readInput("CHANGED_LINES"));
  const citations = findCitations(changedLines);
  const { known, unknown } = resolveIds(citations, index);

  if (unknown.length) {
    console.error(
      "selling-guide-authority-guard: FAIL — an added line cites a Selling Guide section the\n" +
        "committed edition does not contain:\n",
    );
    for (const u of unknown.slice(0, 12)) {
      console.error(`  • ${u.file}: ${u.id}`);
      console.error(`      ${u.line.slice(0, 120)}`);
    }
    console.error(
      "\nThe Guide renumbers between editions — 2026-03-04 moved self-employment income off\n" +
        "B3-3.2/B3-3.4 — so an unknown id is a WRONG citation, not merely an old one. Re-derive it\n" +
        "from docs/fannie-mae/selling-guide/section-index.tsv; never cite from memory.\n" +
        "Naming a historical id on purpose? Put `formerly` (or renumbered/superseded/historical)\n" +
        "on the same line.",
    );
    process.exit(1);
  }

  const triggered = detectTriggers(files);
  if (!triggered.length) {
    console.log(
      `selling-guide-authority-guard: no Guide-governed path in this diff (${files.length} files) — ok.`,
    );
    return;
  }

  const citedInTriggered = known.filter((c) =>
    triggered.some((t) => t.files.includes(c.file)),
  );
  if (citedInTriggered.length) {
    const ids = [...new Set(citedInTriggered.map((c) => c.id))].join(", ");
    console.log(`selling-guide-authority-guard: ok — Guide-governed change cites ${ids}.`);
    return;
  }

  const evidence = hasAuthorityEvidence(process.env.PR_BODY, index);
  if (evidence.ok) {
    console.log("selling-guide-authority-guard: ok — authority recorded in the PR body.");
    return;
  }

  console.error(
    "selling-guide-authority-guard: FAIL — this PR changes Selling Guide-governed logic without\n" +
      "citing the Guide:\n",
  );
  for (const t of triggered) {
    console.error(`  • ${t.label}`);
    for (const f of t.files) console.error(`      ${f}`);
  }
  console.error(`\n  PR body: ${evidence.reason}.`);
  console.error(
    "\nEvery eligibility, underwriting, income or delivery rule in these files traces to a Selling\n" +
      "Guide section. Cite it, or move the logic out of a governed file:\n" +
      "  1. Put the governing section id (e.g. B3-6-05) in the changed lines — a comment or a\n" +
      "     citation object beside the rule — OR add a `## Selling Guide authority` section to the\n" +
      "     PR body listing the ids this change relies on.\n" +
      "  2. Ids must resolve in docs/fannie-mae/selling-guide/section-index.tsv, and you must read\n" +
      "     the section text before relying on it. A resolving id is a pointer, not a verification.\n" +
      `  3. Refactor or plumbing that asserts no policy? Write exactly "${ATTESTATION}"\n` +
      "     in that PR-body section, plus one line of why. That is a recorded attestation with your\n" +
      "     name on it, not a waiver.\n" +
      "\nThis guard proves the citation was written down. It cannot prove it is correct.\n" +
      "Register: knowledge-base/governance/TEAM_PRACTICES.md §10.",
  );
  process.exit(1);
}

module.exports = {
  detectTriggers,
  findCitations,
  resolveIds,
  hasAuthorityEvidence,
  loadSectionIndex,
  parseChangedLines,
  PATH_TRIGGERS,
  ATTESTATION,
  SG_ID,
};

if (require.main === module) main();
