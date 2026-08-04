#!/usr/bin/env node
/**
 * Fannie Mae delivery-stack freeze guard (audit finding F-14).
 *
 * A broker never delivers a loan to Fannie Mae — the wholesale lender is the
 * seller/servicer and owns ULDD delivery, the UCD, the Loan Delivery edits,
 * Special Feature Codes and MERS registration. Yet ~2,300 lines of exactly
 * that live in this repo, reachable through one staff API with no client
 * surface at all.
 *
 * Either it is overhead, or the real plan is mini-correspondent — which would
 * change the company's entire capital picture. That decision is founder-owned
 * (knowledge-base/governance/CHANNEL_DECISION.md), and this guard exists so
 * the decision is not made by accretion in the meantime.
 *
 * While shared/businessChannel.ts declares "broker", the tracked files may
 * SHRINK but not GROW. A ratchet, exactly like the design-token guard: it
 * never asks anyone to delete working code, it only stops more being added to
 * a stack the business may not need.
 *
 * If the channel flips to "correspondent", this guard turns itself off — the
 * stack becomes core infrastructure and should grow.
 *
 * To re-baseline after a deliberate reduction:
 *   node scripts/delivery-stack-freeze-guard.cjs --update
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(ROOT, "scripts/delivery-stack-baseline.json");

// The seller/servicer delivery surface. Deliberately NOT including
// server/mismo.ts or shared/mismo.ts: MISMO 3.4 EXPORT to a wholesale lender
// is core broker work in every channel. Only GSE-delivery-specific code is
// frozen.
const TRACKED = [
  "server/services/loanDeliveryReadiness.ts",
  "shared/fannieMae/loanDeliveryEdits.ts",
  "shared/fannieMae/specialFeatureCodes.ts",
  "shared/fannieMae/ucdFeeEnumerations.ts",
];

function countLines(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return 0;
  return fs.readFileSync(abs, "utf8").split("\n").length;
}

function measure() {
  const files = {};
  let total = 0;
  for (const rel of TRACKED) {
    const lines = countLines(rel);
    files[rel] = lines;
    total += lines;
  }
  return { files, total };
}

let channel = "broker";
try {
  const src = fs.readFileSync(path.join(ROOT, "shared/businessChannel.ts"), "utf8");
  const match = src.match(/export const BUSINESS_CHANNEL:\s*BusinessChannel\s*=\s*"(\w+)"/);
  if (match) channel = match[1];
} catch {
  console.log("delivery-stack-freeze-guard: shared/businessChannel.ts unreadable — assuming broker.");
}

const current = measure();

if (process.argv.includes("--update")) {
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ channel, ...current, updatedAt: null }, null, 2) + "\n",
  );
  console.log(`delivery-stack-freeze-guard: baseline updated to ${current.total} lines.`);
  process.exit(0);
}

if (channel !== "broker") {
  console.log(
    `delivery-stack-freeze-guard: channel is "${channel}" — the delivery stack is core ` +
      `infrastructure in this channel, freeze not enforced. ✅`,
  );
  process.exit(0);
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error(
    "delivery-stack-freeze-guard: baseline missing. Run with --update to create it.",
  );
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));

const grown = TRACKED.filter((rel) => current.files[rel] > (baseline.files[rel] ?? 0));

if (grown.length === 0) {
  const delta = baseline.total - current.total;
  console.log(
    `delivery-stack-freeze-guard: ${current.total} lines across ${TRACKED.length} files ` +
      `(baseline ${baseline.total}${delta > 0 ? `, down ${delta}` : ""}). Frozen, no growth. ✅`,
  );
  process.exit(0);
}

console.error(
  "delivery-stack-freeze-guard: the Fannie Mae delivery stack GREW while the business channel " +
    'is "broker".\n',
);
for (const rel of grown) {
  console.error(`  ${rel}: ${baseline.files[rel] ?? 0} → ${current.files[rel]} lines`);
}
console.error(
  "\nA broker does not deliver loans to Fannie Mae — the wholesale lender is the seller/servicer\n" +
    "and performs this itself. Before adding to this stack, resolve the channel decision:\n" +
    "  knowledge-base/governance/CHANNEL_DECISION.md\n\n" +
    "If the channel really is changing, flip BUSINESS_CHANNEL in shared/businessChannel.ts —\n" +
    "and read CHANNEL_DECISION.md §3 first, because it invalidates the capital picture.\n" +
    "If this growth is a deliberate, justified exception, re-baseline with:\n" +
    "  node scripts/delivery-stack-freeze-guard.cjs --update\n",
);
process.exit(1);
