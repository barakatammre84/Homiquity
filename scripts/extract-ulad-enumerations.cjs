#!/usr/bin/env node
/**
 * ULAD ENUMERATION EXTRACTOR (zero-dep).
 *
 * Writes docs/fannie-mae/schemas/ulad-enumerations.tsv from the "ULAD
 * Enumerations" sheet of the ULAD mapping workbook — the authority that says
 * which values each MISMO v3.4 data point may hold.
 *
 * WHY THIS EXISTS. CLAUDE.md: "Never invent MISMO field names, enumerations,
 * XML container paths, edit codes, or Special Feature Codes." That rule had no
 * executable form, and the code drifted from the authority in ten of the
 * thirteen types that can be compared:
 *
 *     code says  USDA                            ULAD says  USDARuralDevelopment
 *     code says  UniversalLoanIdentifier         ULAD says  UniversalLoan
 *     code says  LeasePayments                   ULAD says  LeasePayment
 *     code says  GiftOfEquity                    ULAD says  GiftOfPropertyEquity
 *     code says  CashValueOfLifeInsurance        ULAD says  LifeInsurance
 *     code says  ProceedsFromRealEstateProperty  ULAD says  PendingNetSaleProceedsFromRealEstateAssets
 *
 * shared/mismo.ts:1198 ships `"USDA"` inside a delivery data-point definition
 * marked `required: true` at DEAL/LOANS/LOAN/TERMS_OF_MORTGAGE/MortgageType,
 * and server/mismo.ts:294 maps `lease -> "LeasePayments"`. Both are values
 * Fannie's own mapping does not contain.
 *
 * THE PATTERN, BORROWED FROM THE SELLING GUIDE. scripts/extract-selling-guide.py
 * leaves the copyrighted source as-is and commits a greppable index
 * (section-index.tsv) so any session can locate a section with no setup. Same
 * shape here: the .xlsx stays untouched, this writes the tracked index that
 * scripts/vocabulary-registry.cjs and pnpm guard:vocab read.
 *
 * NO DEPENDENCY, DELIBERATELY. openpyxl is NOT installed in this environment and
 * adding a runtime dependency to read a file that already sits in the repo is a
 * poor trade. An .xlsx is a zip of XML; Node's zlib inflates it and a small
 * parser walks it. If the workbook is absent this STOPS and says where it
 * looked, rather than emitting an empty index that would read as "no
 * divergences" — the extract-selling-guide.py rule, for the same reason.
 *
 * Run:  node scripts/extract-ulad-enumerations.cjs
 *       node scripts/extract-ulad-enumerations.cjs --check   (verify, write nothing)
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const WORKBOOK = path.join(ROOT, "docs/fannie-mae/schemas/ulad-mapping-document.xlsx");
const OUT = path.join(ROOT, "docs/fannie-mae/schemas/ulad-enumerations.tsv");
const CHECK = process.argv.includes("--check");
const SHEET_NAME = "ULAD Enumerations";

// --------------------------------------------------------------------------
// Minimal zip reader — central directory only, which is all an .xlsx needs.
// --------------------------------------------------------------------------
function readZip(buf) {
  const files = new Map();
  // End of central directory: signature 0x06054b50, scanned from the tail.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("not a zip archive (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    // The local header repeats the name/extra lengths, and its extra field can
    // differ in length from the central one — read the local values, never reuse
    // the central extraLen, or the data offset lands mid-stream.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// --------------------------------------------------------------------------
// Just enough SpreadsheetML. Cells carrying t="s" hold an index into the shared
// string table rather than a literal — read one as a literal and every label
// becomes an integer, which is exactly how the first pass of this script
// produced a table of row numbers.
// --------------------------------------------------------------------------
const stripTags = (s) => s.replace(/<[^>]+>/g, "");
const unescapeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

function sharedStrings(files) {
  const xml = files.get("xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => unescapeXml(stripTags(m[1])));
}

function sheetPath(files, wanted) {
  const wb = files.get("xl/workbook.xml").toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels").toString("utf8");
  const idToTarget = new Map(
    [...rels.matchAll(/Id="(rId\d+)"[^>]*?Target="([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    if (m[1].trim() === wanted) {
      const t = idToTarget.get(m[2]).replace(/^\/?xl\//, "").replace(/^\//, "");
      return `xl/${t}`;
    }
  }
  return null;
}

function rows(files, sheetXmlPath, strings) {
  const xml = files.get(sheetXmlPath).toString("utf8");
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
    [...r[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)].map((c) => {
      const attrs = c[1] ?? c[3] ?? "";
      const body = c[2] ?? "";
      if (/\bt="inlineStr"/.test(attrs)) return unescapeXml(stripTags(body));
      const v = body.match(/<v>([\s\S]*?)<\/v>/);
      if (!v) return "";
      return /\bt="s"/.test(attrs) ? (strings[Number(v[1])] ?? "") : unescapeXml(v[1]);
    }),
  );
}

// --------------------------------------------------------------------------
if (!fs.existsSync(WORKBOOK)) {
  console.error("extract-ulad-enumerations: the ULAD mapping workbook is not here.\n");
  console.error(`  looked for: ${path.relative(ROOT, WORKBOOK)}`);
  console.error("\n  Stopping rather than writing an empty index. An empty enumeration table");
  console.error("  makes every MISMO value look compliant, which is worse than no table at all.");
  process.exit(1);
}

const files = readZip(fs.readFileSync(WORKBOOK));
const strings = sharedStrings(files);
const sp = sheetPath(files, SHEET_NAME);
if (!sp) {
  console.error(`extract-ulad-enumerations: no sheet named "${SHEET_NAME}" in the workbook.`);
  console.error("  The workbook layout changed; re-read it before trusting any downstream guard.");
  process.exit(1);
}

const all = rows(files, sp, strings);
const header = all.find((r) => r.includes("MISMO v3.4 Data Point Name"));
if (!header) {
  console.error("extract-ulad-enumerations: could not find the header row.");
  process.exit(1);
}
const col = (name) => header.findIndex((h) => (h || "").trim() === name);
const iField = col("Form Field ID");
const iPoint = col("MISMO v3.4 Data Point Name");
const iEnum = col("ULAD Supported Enumerations");
const iDef = col("MISMO v3.4 Enumeration Definition");

const out = [];
const seen = new Set();
for (const r of all) {
  const point = (r[iPoint] || "").trim();
  const enumeration = (r[iEnum] || "").trim();
  if (!point || !enumeration || point === "MISMO v3.4 Data Point Name") continue;
  const key = `${point}\t${enumeration}`;
  if (seen.has(key)) continue; // the sheet repeats a pair per URLA field; the pair is the fact
  seen.add(key);
  out.push([
    point,
    enumeration,
    (r[iField] || "").trim().replace(/\s+/g, " "),
    (r[iDef] || "").trim().replace(/\s+/g, " ").slice(0, 240),
  ].join("\t"));
}
out.sort();

const points = new Set(out.map((l) => l.split("\t")[0]));
const body =
  "# GENERATED by scripts/extract-ulad-enumerations.cjs — do not hand-edit.\n" +
  `# Source: ${path.relative(ROOT, WORKBOOK)}, sheet "${SHEET_NAME}".\n` +
  "# The authority for which values each MISMO v3.4 data point may hold.\n" +
  "# CLAUDE.md: never invent MISMO field names, enumerations, edit codes or SFCs.\n" +
  "#\n" +
  "dataPoint\tenumeration\turlaFieldId\tdefinition\n" +
  out.join("\n") + "\n";

if (CHECK) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== body) {
    console.error("extract-ulad-enumerations: the tracked index is STALE.");
    console.error(`  run: node scripts/extract-ulad-enumerations.cjs   (and commit ${path.relative(ROOT, OUT)})`);
    process.exit(1);
  }
  console.log(`extract-ulad-enumerations: index current — ${points.size} data points, ${out.length} enumerations. ✅`);
  process.exit(0);
}

fs.writeFileSync(OUT, body);
console.log(
  `extract-ulad-enumerations: wrote ${path.relative(ROOT, OUT)} — ` +
    `${points.size} data points, ${out.length} enumerations.`,
);
