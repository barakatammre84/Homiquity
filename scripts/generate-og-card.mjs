#!/usr/bin/env node
/**
 * Default social card generator (zero new dependencies).
 *
 * Emits client/public/og-card.png — the 1200x630 image every link unfurler shows
 * for a homiquity.com URL. Before this the card was an undocumented committed
 * binary with NO source: emerald #0C6E52 on white, a green rounded-square mark,
 * and a green left rail. Nothing in the repo could regenerate it, and it survived
 * the palette rebuild untouched, so every shared link advertised a brand the
 * product had already retired.
 *
 *   pnpm brand:og            regenerate the card
 *   pnpm brand:og --check    verify it matches the source, write nothing (CI)
 *
 * WHY A NEW FILENAME rather than overwriting og-default.png: server/index-prod.ts
 * serves dist/public with `maxAge: "1y", immutable`, and Vite copies publicDir
 * verbatim WITHOUT content-hashing. Replacing the bytes of a name that browsers
 * and scraper caches already hold as immutable reaches nobody who has seen the
 * site. A future change to this card needs a new filename for the same reason —
 * there is no cache-busting query string that a social scraper respects.
 *
 * FONTS ARE COMMITTED, NOT FETCHED. attached_assets/brand/fonts/ holds the Latin
 * subsets. A generator that reached for Google Fonts would render whatever the
 * network gave it, and headless Chrome does not fail on a missing webfont — it
 * silently falls back, so a card that looks nothing like the brand would ship and
 * no guard would catch it. `assertBrandFontsLoaded` below measures instead of
 * trusting.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "client", "public");
const FONT_DIR = path.join(ROOT, "attached_assets", "brand", "fonts");
const MARK = path.join(PUBLIC_DIR, "brand", "mark.png");
const OUT_NAME = "og-card.png";
const LEGACY_NAME = "og-default.png";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findChrome() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const found = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) throw new Error("No Chrome/Chromium found. Set CHROME_PATH.");
  return found;
}

/**
 * Palette. Duplicated from index.css ON PURPOSE and kept to the four values the
 * card uses — this file renders in headless Chrome with no Tailwind and no CSS
 * variables, so it cannot import the tokens. Every value here is a copy that can
 * drift; --check exists so CI notices when the card stops matching the source,
 * and DESIGN_SYSTEM §9 names this as the one sanctioned copy of the palette.
 */
const C = {
  ground: "#0B1E19", // precision.950 green-black
  flare: "#FF5E00", // --flare, sampled from the logomark
  white: "#FFFFFF",
  muted: "#93A5A0", // precision.300, the only grey that reads on the ground
};

const HEADLINE = "Clarity for every stage of homeownership.";
const SUBLINE = "Pre-approval, property search, and guidance — in one place.";
// Equal Housing Opportunity appears as TEXT, never as a drawn house-and-equals
// glyph. That mark is HUD-published with its own usage rules and does not exist
// in this repo in any form; drawing an approximation would be fabricating a
// regulatory mark on a public marketing surface.
const FOOTLINE = "homiquity.com · Equal Housing Opportunity";

function b64(file) {
  return fs.readFileSync(file).toString("base64");
}

function buildPage() {
  const fontFace = (family, weight, file) => `
    @font-face {
      font-family: '${family}';
      font-style: normal;
      font-weight: ${weight};
      src: url(data:font/woff2;base64,${b64(path.join(FONT_DIR, file))}) format('woff2');
    }`;

  return `<!doctype html><meta charset="utf-8"><style>
${fontFace("Bricolage Grotesque", 800, "bricolage-grotesque-800.woff2")}
${fontFace("Geist", 400, "geist-400.woff2")}
${fontFace("Geist", 600, "geist-600.woff2")}
  html,body{margin:0;padding:0;width:1200px;height:630px;overflow:hidden}
  body{background:${C.ground};display:flex;flex-direction:column;align-items:center;
       justify-content:center;gap:0;font-family:'Geist',sans-serif}
  /* Everything is CENTRED, not left-aligned, and that is a requirement rather
     than a taste: WhatsApp, iMessage and several Android surfaces render a link
     preview as a SQUARE centre-crop of the 1200x630, which is the middle 630px.
     A left-aligned lockup sits entirely outside that window and those clients
     would show a headline fragment with no brand on it at all. */
  .lockup{display:flex;align-items:center;gap:18px;margin-bottom:38px}
  .mark{width:64px;height:82px;background-color:${C.flare};
        -webkit-mask:url(data:image/png;base64,MARK_B64) center/contain no-repeat;
        mask:url(data:image/png;base64,MARK_B64) center/contain no-repeat}
  .word{font-family:'Geist',sans-serif;font-weight:600;font-size:46px;
        letter-spacing:-0.03em;color:${C.flare};line-height:1}
  h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:60px;
     line-height:1.08;letter-spacing:-0.02em;color:${C.white};text-align:center;
     max-width:900px;margin:0}
  p{font-size:24px;line-height:1.4;color:${C.muted};text-align:center;
    max-width:760px;margin:26px 0 0}
  .foot{position:absolute;bottom:44px;font-size:19px;color:${C.muted};letter-spacing:0.01em}
  /* Off-screen probes: measured, never shown. */
  #probes{position:absolute;top:-9999px;left:-9999px;white-space:nowrap;font-size:100px}
  #brandProbe{font-family:'Bricolage Grotesque'}
  #fallbackProbe{font-family:'__definitely_not_installed__'}
</style>
<div class="lockup"><span class="mark"></span><span class="word">homiquity</span></div>
<h1>${HEADLINE}</h1>
<p>${SUBLINE}</p>
<div class="foot">${FOOTLINE}</div>
<div id="probes"><span id="brandProbe">Homiquity</span><span id="fallbackProbe">Homiquity</span></div>
<script>
  document.fonts.ready.then(function(){
    var b = document.getElementById('brandProbe').getBoundingClientRect().width;
    var f = document.getElementById('fallbackProbe').getBoundingClientRect().width;
    // If the brand face never loaded, Chrome renders the probe in the SAME
    // fallback as the sentinel and the two widths match to the pixel.
    document.title = (Math.abs(b - f) > 1 ? 'FONTS_OK' : 'FONTS_FELL_BACK') +
                     ' brand=' + b.toFixed(1) + ' fallback=' + f.toFixed(1);
  });
</script>`;
}

/**
 * Fail loudly if the committed woff2 did not take. Chrome silently substitutes a
 * missing webfont, so without this the card would ship in the system UI face and
 * look plausible enough that nobody would look twice.
 */
function assertBrandFontsLoaded(chrome, pageFile) {
  const dom = execFileSync(
    chrome,
    ["--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
      "--virtual-time-budget=15000", "--dump-dom", `file://${pageFile}`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
  );
  const m = dom.match(/<title>([^<]*)<\/title>/);
  const title = m ? m[1] : "(no title — the probe script never ran)";
  if (!title.startsWith("FONTS_OK")) {
    throw new Error(
      `Brand fonts did not load: ${title}\n` +
        `  Expected the woff2 files in ${path.relative(ROOT, FONT_DIR)} to be embedded.\n` +
        `  A card rendered in the fallback face is NOT shippable.`,
    );
  }
  return title;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");

  for (const f of ["bricolage-grotesque-800.woff2", "geist-400.woff2", "geist-600.woff2"]) {
    const p = path.join(FONT_DIR, f);
    if (!fs.existsSync(p)) {
      console.error(`✗ missing font: ${path.relative(ROOT, p)}`);
      process.exit(1);
    }
  }
  if (!fs.existsSync(MARK)) {
    console.error(`✗ missing mark: ${path.relative(ROOT, MARK)} — run pnpm brand:assets first`);
    process.exit(1);
  }

  const chrome = findChrome();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-card-"));
  const outDir = check ? tmpDir : PUBLIC_DIR;
  const out = path.join(outDir, OUT_NAME);

  try {
    const html = buildPage().replace(/MARK_B64/g, b64(MARK));
    const page = path.join(tmpDir, "card.html");
    fs.writeFileSync(page, html);

    const fontStatus = assertBrandFontsLoaded(chrome, page);

    execFileSync(
      chrome,
      ["--headless", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
        "--hide-scrollbars", "--force-device-scale-factor=1", "--virtual-time-budget=15000",
        "--window-size=1200,630", `--screenshot=${out}`, `file://${page}`],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    if (!fs.existsSync(out)) throw new Error("Chrome wrote nothing");

    // The legacy filename gets the SAME bytes. Every og:image reference now points
    // at og-card.png, but links shared before this change are out in the world
    // naming og-default.png, and a scraper that has not cached one yet would
    // otherwise fetch the retired green card. Refreshing it cannot fix anything
    // already cached (immutable, one year) — it only stops NEW fetches of the old
    // URL from advertising a brand the product dropped. The cost is that the
    // original artwork is gone from the working tree; it is in git history.
    const legacy = path.join(outDir, LEGACY_NAME);
    fs.copyFileSync(out, legacy);

    if (check) {
      let drift = 0;
      for (const name of [OUT_NAME, LEGACY_NAME]) {
        const committed = path.join(PUBLIC_DIR, name);
        const fresh = path.join(outDir, name);
        if (!fs.existsSync(committed) || !fs.readFileSync(committed).equals(fs.readFileSync(fresh))) {
          console.error(`✗ ${name} is stale or missing.`);
          drift++;
        }
      }
      if (drift) {
        console.error(`\n${drift} card(s) out of sync.\n  Run: pnpm brand:og`);
        process.exit(1);
      }
      console.log(`✓ ${OUT_NAME} + ${LEGACY_NAME} in sync with their source (${fontStatus})`);
    } else {
      const kb = (fs.statSync(out).size / 1024).toFixed(1);
      console.log(`✓ ${OUT_NAME}  1200×630  ${kb} kB  (${fontStatus})`);
      console.log(`✓ ${LEGACY_NAME}  same bytes — legacy alias for links already shared`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();
