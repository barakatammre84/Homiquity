#!/usr/bin/env node
/**
 * Regulatory change watcher — polls the OFFICIAL public sources for guideline
 * and rulemaking changes and diffs against the last-seen state committed in
 * data/regulatory/regulatory-watch-state.json.
 *
 *   node scripts/regulatory-watch.cjs                 # report changes, exit 2 if any
 *   node scripts/regulatory-watch.cjs --update-state  # also persist the new state
 *
 * Sources:
 *  - Federal Register API (free, structured): CFPB + HUD + VA mortgage rulemaking
 *  - Fannie Mae Selling Guide announcements page   (content hash)
 *  - Freddie Mac Guide bulletins page              (content hash)
 *  - FHA (HUD) Mortgagee Letters page              (content hash)
 *  - VA circulars page                             (content hash)
 *
 * Page-hash detection is deliberately coarse: ANY change on an official
 * update page is worth a human/guardian look. An unreachable source is
 * reported (never silently skipped) — a watcher that fails quietly is worse
 * than no watcher.
 *
 * Exit codes: 0 = no changes, 2 = changes detected, 1 = watcher error.
 */
const fs = require("fs");
const path = require("path");
const { createHash } = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(ROOT, "data/regulatory/regulatory-watch-state.json");
const UPDATE_STATE = process.argv.includes("--update-state");

const FR_API =
  "https://www.federalregister.gov/api/v1/documents.json?per_page=10&order=newest" +
  "&conditions%5Bterm%5D=mortgage" +
  "&conditions%5Bagencies%5D%5B%5D=consumer-financial-protection-bureau" +
  "&conditions%5Bagencies%5D%5B%5D=housing-and-urban-development-department" +
  "&conditions%5Bagencies%5D%5B%5D=veterans-affairs-department" +
  "&conditions%5Btype%5D%5B%5D=RULE&conditions%5Btype%5D%5B%5D=PRORULE";

const PAGE_SOURCES = [
  {
    id: "fannie-selling-guide-announcements",
    label: "Fannie Mae Selling Guide announcements",
    url: "https://singlefamily.fanniemae.com/selling-servicing-guide-communications",
  },
  {
    id: "freddie-guide-bulletins",
    label: "Freddie Mac Guide bulletins",
    url: "https://guide.freddiemac.com/app/guide/bulletins",
  },
  {
    id: "fha-mortgagee-letters",
    label: "FHA (HUD) Mortgagee Letters",
    url: "https://www.hud.gov/program_offices/administration/hudclips/letters/mortgagee",
  },
  {
    id: "va-circulars",
    label: "VA Home Loans circulars",
    url: "https://www.benefits.va.gov/homeloans/resources_circulars.asp",
  },
];

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "HomiquityComplianceWatch/1.0 (guideline change monitoring)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Strip volatile markup so the hash tracks content, not asset fingerprints. */
function contentHash(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

async function main() {
  const state = fs.existsSync(STATE_PATH)
    ? JSON.parse(fs.readFileSync(STATE_PATH, "utf8"))
    : { federalRegisterSeen: [], pageHashes: {}, lastRun: null };

  const changes = [];
  const errors = [];

  // --- Federal Register (structured) ---------------------------------------
  try {
    const body = JSON.parse(await fetchText(FR_API));
    const docs = (body.results ?? []).map((d) => ({
      number: d.document_number,
      title: d.title,
      agency: (d.agencies ?? []).map((a) => a.name).join(", "),
      date: d.publication_date,
      url: d.html_url,
    }));
    const seen = new Set(state.federalRegisterSeen);
    const fresh = docs.filter((d) => !seen.has(d.number));
    for (const d of fresh) {
      changes.push(`Federal Register ${d.date} [${d.agency}]: ${d.title}\n      ${d.url}`);
    }
    state.federalRegisterSeen = [
      ...new Set([...docs.map((d) => d.number), ...state.federalRegisterSeen]),
    ].slice(0, 100);
  } catch (err) {
    errors.push(`Federal Register API unreachable: ${err.message}`);
  }

  // --- Agency update pages (hash diff) --------------------------------------
  for (const source of PAGE_SOURCES) {
    try {
      const hash = contentHash(await fetchText(source.url));
      const previous = state.pageHashes[source.id];
      if (previous && previous !== hash) {
        changes.push(`${source.label} page changed → review ${source.url}`);
      } else if (!previous) {
        console.log(`BASELINE  ${source.label}: recorded initial hash ${hash}`);
      }
      state.pageHashes[source.id] = hash;
    } catch (err) {
      errors.push(`${source.label} unreachable (${source.url}): ${err.message}`);
    }
  }

  state.lastRun = new Date().toISOString();
  if (UPDATE_STATE) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
  }

  for (const e of errors) console.log(`WARN  ${e}`);
  if (changes.length > 0) {
    console.log(`\n${changes.length} regulatory change signal(s) detected:`);
    for (const c of changes) console.log(`  • ${c}`);
    console.log(
      "\nAction: review each item; if a guideline our engine implements changed, file a" +
        " 'Correction to S-XX' in knowledge-base/compliance/UNDERWRITING_SCENARIOS.md and update data/regulatory/regulatory-ledger.json.",
    );
    process.exit(2);
  }
  console.log(`No regulatory changes detected (${PAGE_SOURCES.length} pages + Federal Register).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Watcher error:", err);
  process.exit(1);
});
