/**
 * Homiquity — Lender Demo deck generator (pptxgenjs).
 * Full end-to-end story for wholesale/TPO lenders. Royal Blue Emerald brand.
 * Honesty rails: licensed (NMLS #427468, IL only) but pre-launch gated; vendor legs are deterministic simulations
 * behind production adapters (never claimed live).
 */
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const FA = require("react-icons/fa");

const path = require("path");
const OUT = path.join(__dirname, "Homiquity_Lender_Demo.pptx");
const SHOTS = path.join(__dirname, "screenshots");

// ---- Palette (Royal Blue Emerald, from client/src/index.css tokens) ----
const ROYAL       = "1C3A8F"; // vivid royal blue — dark slide surfaces
const ROYAL_DEEP  = "142A66"; // deeper royal — cards/gradient feel
const INK         = "0F1729"; // near-black navy — body text
const EMERALD      = "0B7A5E"; // deep emerald — accents on light
const EMERALD_BR   = "10B981"; // bright emerald — accents on dark
const SLATE        = "5B6472"; // muted text
const MUTED        = "F1F5F9"; // muted surface
const ROYAL_TINT   = "EEF2FB"; // royal-tinted card
const EMER_TINT    = "E9F6F0"; // emerald-tinted card
const GOLD         = "B8892B"; // veteran mark (off-palette, factual only)
const WHITE        = "FFFFFF";

const FH = "Cambria";  // headings (serif — trust register)
const FB = "Calibri";  // body

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.author = "Homiquity Mortgage Corporation";
pres.company = "Homiquity Mortgage Corporation";
pres.title = "Homiquity — Lender Demo";
const PW = 13.333, PH = 7.5, M = 0.7;

// ---- icon rasterization cache ----
const _iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (_iconCache[key]) return _iconCache[key];
  const Comp = FA[name];
  if (!Comp) throw new Error("missing icon " + name);
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Comp, { color: "#" + color, size: "256" })
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const data = "image/png;base64," + png.toString("base64");
  _iconCache[key] = data;
  return data;
}
const shadow = () => ({ type: "outer", color: "9AA6B8", blur: 7, offset: 3, angle: 90, opacity: 0.28 });

// ---- reusable pieces ----
function footer(slide, page) {
  slide.addText(
    [{ text: "Homiquity Mortgage Corp.", options: { bold: true, color: ROYAL } },
     { text: "   ·   Confidential — for prospective wholesale-lender partners", options: { color: SLATE } }],
    { x: M, y: PH - 0.42, w: 10, h: 0.3, fontFace: FB, fontSize: 9, align: "left", margin: 0 }
  );
  slide.addText(String(page), { x: PW - 1.1, y: PH - 0.42, w: 0.4, h: 0.3, fontFace: FB, fontSize: 9, color: SLATE, align: "right", margin: 0 });
}
function slideTitle(slide, kicker, title) {
  slide.addText(kicker.toUpperCase(), { x: M, y: 0.5, w: PW - 2 * M, h: 0.3, fontFace: FB, bold: true, fontSize: 12, color: EMERALD, charSpacing: 2, margin: 0 });
  slide.addText(title, { x: M, y: 0.8, w: PW - 2 * M, h: 0.75, fontFace: FH, bold: true, fontSize: 30, color: INK, margin: 0 });
}
async function iconCircle(slide, name, x, y, d, circleColor, iconColor) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: circleColor } });
  const ip = d * 0.44, off = (d - ip) / 2;
  slide.addImage({ data: await icon(name, iconColor), x: x + off, y: y + off, w: ip, h: ip });
}
// veteran mark (small, factual — no cert claim)
async function veteranMark(slide, x, y, onDark) {
  slide.addImage({ data: await icon("FaMedal", GOLD), x, y, w: 0.28, h: 0.28 });
  slide.addText("Veteran-founded", { x: x + 0.34, y: y - 0.02, w: 2.2, h: 0.32, fontFace: FB, fontSize: 11, bold: true, color: onDark ? WHITE : INK, valign: "middle", margin: 0 });
}
// browser-framed real screenshot (image is 1.6:1) + caption
function screenshotCard(slide, img, x, y, w, caption) {
  const barH = 0.34, imgW = w - 0.24, imgH = imgW / 1.6, cardH = barH + imgH + 0.18;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: cardH, rectRadius: 0.07, fill: { color: WHITE }, line: { color: "E2E8F0", width: 1 }, shadow: shadow() });
  ["F87171", "FBBF24", "34D399"].forEach((c, i) =>
    slide.addShape(pres.shapes.OVAL, { x: x + 0.2 + i * 0.17, y: y + 0.13, w: 0.09, h: 0.09, fill: { color: c } }));
  slide.addImage({ path: img, x: x + 0.12, y: y + barH, w: imgW, h: imgH });
  slide.addText(caption, { x, y: y + cardH + 0.06, w, h: 0.5, fontFace: FB, fontSize: 12, color: SLATE, align: "center", valign: "top", margin: 0 });
}

// ==========================================================================
async function build() {
  // ---------- S1 — TITLE (dark royal) ----------
  {
    const s = pres.addSlide();
    s.background = { color: ROYAL_DEEP };
    // subtle emerald motif ovals top-right
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: -1.4, w: 4.2, h: 4.2, fill: { color: ROYAL, transparency: 30 } });
    s.addShape(pres.shapes.OVAL, { x: 11.9, y: 0.5, w: 2.0, h: 2.0, fill: { color: EMERALD_BR, transparency: 55 } });
    s.addText("HOMIQUITY  ·  MORTGAGE CORPORATION", { x: M, y: 1.5, w: 10, h: 0.35, fontFace: FB, bold: true, fontSize: 13, color: EMERALD_BR, charSpacing: 3, margin: 0 });
    s.addText("A digital mortgage brokerage that\ndelivers lender-ready files.", { x: M, y: 2.1, w: 11.4, h: 1.9, fontFace: FH, bold: true, fontSize: 42, color: WHITE, lineSpacingMultiple: 1.02, margin: 0 });
    s.addText(
      [{ text: "Certainty and speed", options: { italic: true, bold: true, color: EMERALD_BR } },
       { text: " — a complete, standards-valid MISMO 3.4 package,\ndecision-ready on the first pass.", options: { color: "D5DEF5" } }],
      { x: M, y: 4.15, w: 11, h: 0.95, fontFace: FB, fontSize: 18, lineSpacingMultiple: 1.05, margin: 0 }
    );
    // credentialing status line (honest)
    s.addText("Wholesale-partner briefing  ·  NMLS #427468  ·  Illinois", { x: M, y: 6.35, w: 9, h: 0.35, fontFace: FB, fontSize: 12, color: "AEBCE0", margin: 0 });
    await veteranMark(s, M, 6.78, true);
  }

  // ---------- S2 — THE PROBLEM ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "The problem", "The file is a mess — so everyone pays for it");
    const pains = [
      ["FaClock", "The borrower waits, blind", "Days pass with no idea where they stand — anxiety, drop-off, and lost deals."],
      ["FaFileAlt", "The lender gets a disorganized packet", "Incomplete, non-standard files get bounced back for what's missing — twice."],
      ["FaExchangeAlt", "Everyone re-keys the same data", "The same numbers are re-entered by hand at every hand-off, adding errors and delay."],
    ];
    let y = 1.85;
    for (const [ic, h, b] of pains) {
      await iconCircle(s, ic, M, y, 0.7, ROYAL_TINT, ROYAL);
      s.addText(h, { x: M + 0.95, y: y - 0.04, w: 6.4, h: 0.4, fontFace: FB, bold: true, fontSize: 17, color: INK, margin: 0 });
      s.addText(b, { x: M + 0.95, y: y + 0.35, w: 6.4, h: 0.7, fontFace: FB, fontSize: 13.5, color: SLATE, margin: 0 });
      y += 1.55;
    }
    // right: resolution card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.5, y: 1.95, w: 4.1, h: 4.4, rectRadius: 0.14, fill: { color: EMER_TINT }, shadow: shadow() });
    await iconCircle(s, "FaLayerGroup", 8.85, 2.35, 0.9, EMERALD, WHITE);
    s.addText("Homiquity's fix", { x: 8.85, y: 3.4, w: 3.4, h: 0.35, fontFace: FB, bold: true, fontSize: 13, color: EMERALD, charSpacing: 1, margin: 0 });
    s.addText("Turn a borrower's raw inputs into one organized, lender-ready package — fast, honest, and compliant — and deliver it straight to a wholesale lender.", { x: 8.85, y: 3.75, w: 3.45, h: 2.2, fontFace: FH, fontSize: 17, color: INK, lineSpacingMultiple: 1.05, margin: 0 });
    footer(s, 2);
  }

  // ---------- S3 — WHAT HOMIQUITY IS (the core loop) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "What we are", "A mortgage broker — the loop is borrower ↔ lender");
    // three nodes: Borrower  →  Homiquity  →  Wholesale lender
    const nodeY = 2.6, nodeH = 1.7;
    const nodes = [
      ["FaUsers", "Borrower", "Applies, uploads,\nis coached", ROYAL, ROYAL_TINT, 0.9],
      ["FaLayerGroup", "Homiquity", "Organizes, validates,\npackages, delivers", EMERALD, EMER_TINT, 5.05],
      ["FaUniversity", "Wholesale lender", "Underwrites, closes,\nfunds", ROYAL, ROYAL_TINT, 9.2],
    ];
    const nW = 3.1;
    for (const [ic, h, b, col, tint, x] of nodes) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: nodeY, w: nW, h: nodeH, rectRadius: 0.12, fill: { color: tint }, shadow: shadow() });
      await iconCircle(s, ic, x + 0.35, nodeY + 0.32, 0.75, col, WHITE);
      s.addText(h, { x: x + 1.2, y: nodeY + 0.32, w: nW - 1.35, h: 0.75, fontFace: FB, bold: true, fontSize: 16, color: INK, valign: "middle", margin: 0 });
      s.addText(b, { x: x + 0.35, y: nodeY + 1.02, w: nW - 0.6, h: 0.6, fontFace: FB, fontSize: 12.5, color: SLATE, margin: 0 });
    }
    // arrows between
    for (const ax of [4.2, 8.35]) {
      s.addImage({ data: await icon("FaArrowRight", EMERALD), x: ax, y: nodeY + 0.6, w: 0.5, h: 0.5 });
    }
    s.addText(
      [{ text: "One sentence:  ", options: { bold: true, color: EMERALD } },
       { text: "a borrower completes intake → gets an instant, deterministic pre-approval read → their file becomes a standards-valid MISMO package → we deliver it to a wholesale lender.", options: { color: INK } }],
      { x: M, y: 5.0, w: PW - 2 * M, h: 1.0, fontFace: FB, fontSize: 16, lineSpacingMultiple: 1.08, align: "left", margin: 0 }
    );
    s.addText("Agents, listings, and homeowner tools feed or extend the loop — they never sit on the critical path to a funded loan.", { x: M, y: 6.05, w: PW - 2 * M, h: 0.5, fontFace: FB, italic: true, fontSize: 12.5, color: SLATE, margin: 0 });
    footer(s, 3);
  }

  // ---------- S4 — THE PIPELINE (money slide) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "The pipeline", "From lead to a funded-ready package — end to end");
    const steps = [
      ["FaChartLine", "Acquire", "Persona funnel\n+ SEO"],
      ["FaFileSignature", "Intake", "Consented URLA\n+ TRID clock"],
      ["FaClipboardCheck", "Decide", "Deterministic\npre-approval"],
      ["FaLayerGroup", "Package", "MISMO 3.4 /\nULDD valid"],
      ["FaSearch", "Dual AUS", "DU + LPA\nfindings"],
      ["FaPaperPlane", "Deliver", "To wholesale\nlender"],
    ];
    const n = steps.length, gap = 0.42, totalW = PW - 2 * M;
    const cardW = (totalW - gap * (n - 1)) / n, cardH = 2.5, y = 2.15;
    for (let i = 0; i < n; i++) {
      const x = M + i * (cardW + gap);
      const [ic, h, b] = steps[i];
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h: cardH, rectRadius: 0.1, fill: { color: i % 2 ? EMER_TINT : ROYAL_TINT }, shadow: shadow() });
      s.addText(String(i + 1), { x: x + 0.15, y: y + 0.12, w: 0.5, h: 0.4, fontFace: FH, bold: true, fontSize: 18, color: i % 2 ? EMERALD : ROYAL, margin: 0 });
      await iconCircle(s, ic, x + (cardW - 0.8) / 2, y + 0.6, 0.8, i % 2 ? EMERALD : ROYAL, WHITE);
      s.addText(h, { x, y: y + 1.5, w: cardW, h: 0.35, fontFace: FB, bold: true, fontSize: 15, color: INK, align: "center", margin: 0 });
      s.addText(b, { x: x + 0.05, y: y + 1.85, w: cardW - 0.1, h: 0.55, fontFace: FB, fontSize: 11, color: SLATE, align: "center", margin: 0 });
      if (i < n - 1) s.addImage({ data: await icon("FaChevronRight", "AAB4C4"), x: x + cardW + (gap - 0.22) / 2, y: y + cardH / 2 - 0.11, w: 0.22, h: 0.22 });
    }
    // audit-trail content row (not decoration — a real property of the pipeline)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.15, w: totalW, h: 0.95, rectRadius: 0.1, fill: { color: INK } });
    await iconCircle(s, "FaLock", M + 0.28, 5.35, 0.55, EMERALD_BR, INK);
    s.addText(
      [{ text: "Gated + audited end to end.  ", options: { bold: true, color: EMERALD_BR } },
       { text: "Submission is blocked until intake, AUS, and the lender package are clean — and every step is captured for the record.", options: { color: "E6ECFA" } }],
      { x: M + 1.05, y: 5.15, w: totalW - 1.3, h: 0.95, fontFace: FB, fontSize: 13.5, color: WHITE, valign: "middle", margin: 0 }
    );
    footer(s, 4);
  }

  // ---------- S5 — STAGE 1: ACQUISITION ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 1 · Acquire", "We bring you qualified, consented borrowers");
    s.addText("A purpose-built top-of-funnel — persona landing pages, an SEO/content engine, and free decision tools — captures buyers early and hands them into the loop with consent already in hand.", { x: M, y: 1.75, w: 5.4, h: 1.9, fontFace: FB, fontSize: 15, color: INK, lineSpacingMultiple: 1.1, margin: 0 });
    const feats = [
      ["FaBullseye", "Persona landing pages", "First-time buyer, VA, self-employed, refinance"],
      ["FaChartLine", "SEO + education engine", "Articles, glossary, buying-power tools that rank"],
      ["FaClipboardCheck", "Approval Strength + calculators", "Nine calculators that turn browsers into applicants"],
    ];
    let y = 3.75;
    for (const [ic, h, b] of feats) {
      await iconCircle(s, ic, M, y, 0.55, EMERALD, WHITE);
      s.addText(h, { x: M + 0.75, y: y - 0.06, w: 4.9, h: 0.35, fontFace: FB, bold: true, fontSize: 14, color: INK, margin: 0 });
      s.addText(b, { x: M + 0.75, y: y + 0.28, w: 4.9, h: 0.35, fontFace: FB, fontSize: 12, color: SLATE, margin: 0 });
      y += 0.95;
    }
    // right: 2x2 persona grid
    const personas = [["FaHome", "First-time buyer"], ["FaMedal", "VA loans"], ["FaFileAlt", "Self-employed"], ["FaExchangeAlt", "Refinance"]];
    const gx = 6.9, gy = 1.85, cw = 2.85, ch = 2.15, gp = 0.35;
    for (let i = 0; i < 4; i++) {
      const x = gx + (i % 2) * (cw + gp), yy = gy + Math.floor(i / 2) * (ch + gp);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: yy, w: cw, h: ch, rectRadius: 0.1, fill: { color: i % 2 ? ROYAL_TINT : EMER_TINT }, shadow: shadow() });
      await iconCircle(s, personas[i][0], x + (cw - 0.85) / 2, yy + 0.42, 0.85, i % 2 ? ROYAL : EMERALD, WHITE);
      s.addText(personas[i][1], { x, y: yy + 1.45, w: cw, h: 0.5, fontFace: FB, bold: true, fontSize: 14, color: INK, align: "center", margin: 0 });
    }
    footer(s, 5);
  }

  // ---------- S6 — STAGE 2: INTAKE ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 2 · Intake", "A complete, consented application — done right");
    const rows = [
      ["FaFileSignature", "Consented URLA (Form 1003)", "The full application, captured cleanly — with the borrower's consent recorded before anything moves."],
      ["FaRegClock", "TRID clock starts at exactly six pieces", "Not a moment sooner or later — the six application elements trigger the timing, correctly, every time."],
      ["FaCheckCircle", "E-disclosures + e-consent", "ESIGN-compliant delivery and consent, tracked and auditable."],
      ["FaRobot", "AI document coaching — extraction only", "AI structures and completes the file. It never decides, and never implies approval or eligibility."],
    ];
    let y = 1.9;
    for (const [ic, h, b] of rows) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: PW - 2 * M, h: 1.05, rectRadius: 0.1, fill: { color: MUTED } });
      await iconCircle(s, ic, M + 0.28, y + 0.24, 0.58, ROYAL, WHITE);
      s.addText(h, { x: M + 1.15, y: y + 0.12, w: 4.6, h: 0.8, fontFace: FB, bold: true, fontSize: 15, color: INK, valign: "middle", margin: 0 });
      s.addText(b, { x: M + 6.0, y: y + 0.12, w: 5.6, h: 0.8, fontFace: FB, fontSize: 12.5, color: SLATE, valign: "middle", margin: 0 });
      y += 1.2;
    }
    footer(s, 6);
  }

  // ---------- S7 — STAGE 3: UNDERWRITING ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 3 · Decide", "An instant pre-approval read you can trust");
    // left big statement card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.9, w: 4.5, h: 4.35, rectRadius: 0.14, fill: { color: ROYAL_DEEP }, shadow: shadow() });
    s.addText("Deterministic.\nAI-free.\nAuditable.", { x: M + 0.4, y: 2.35, w: 3.7, h: 2.0, fontFace: FH, bold: true, fontSize: 32, color: WHITE, lineSpacingMultiple: 1.02, margin: 0 });
    s.addText("Same inputs → same outcome. No black box, no model deciding who qualifies.", { x: M + 0.4, y: 5.05, w: 3.7, h: 1.0, fontFace: FB, fontSize: 14, color: "CFE7DD", lineSpacingMultiple: 1.08, margin: 0 });
    const rows = [
      ["FaBolt", "Instant read in one session", "Affordability, DTI, and credit-tier math resolve immediately — the borrower knows where they stand."],
      ["FaBalanceScale", "LLPA-aware pricing", "Pricing adjustments computed against agency grids — cited, not guessed."],
      ["FaRoute", "Ambiguity routes to a human", "Edge cases are escalated to staff, never auto-decided by the machine."],
      ["FaShieldAlt", "Adverse action handled", "No adverse action without the required notice — FCRA/ECOA by construction."],
    ];
    let y = 1.95, x = 5.65;
    for (const [ic, h, b] of rows) {
      await iconCircle(s, ic, x, y, 0.6, EMERALD, WHITE);
      s.addText(h, { x: x + 0.8, y: y - 0.06, w: 6.3, h: 0.35, fontFace: FB, bold: true, fontSize: 15, color: INK, margin: 0 });
      s.addText(b, { x: x + 0.8, y: y + 0.3, w: 6.3, h: 0.6, fontFace: FB, fontSize: 12.5, color: SLATE, margin: 0 });
      y += 1.1;
    }
    footer(s, 7);
  }

  // ---------- S8 — STAGE 4: THE LENDER-READY PACKAGE ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 4 · Package", "A package that's decision-ready on the first pass");
    const cards = [
      ["FaLayerGroup", "MISMO 3.4 / ULDD", "Standards-valid output (ULDD Phase 5) — the format your systems ingest."],
      ["FaBalanceScale", "QM points-and-fees", "Points-and-fees and APR-APOR spread pre-flighted against the note-date thresholds."],
      ["FaShieldAlt", "Anti-steering disclosure", "Reg Z §1026.36(e)(3) options presented before anything is locked."],
      ["FaFileSignature", "Special Feature Codes", "SFCs derived and validated as a set — not hand-typed."],
      ["FaClipboardCheck", "UCD / ULDD / EarlyCheck mirror", "We run your delivery edits as a lender's-eye pre-check before you ever see the file."],
      ["FaCheckCircle", "Complete + consistent", "Outstanding-document gating means nothing critical is missing at submission."],
    ];
    const gx = M, gy = 1.9, cols = 3, cw = (PW - 2 * M - 2 * 0.35) / 3, ch = 1.75, gp = 0.35;
    for (let i = 0; i < cards.length; i++) {
      const x = gx + (i % cols) * (cw + gp), y = gy + Math.floor(i / cols) * (ch + gp);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: MUTED }, shadow: shadow() });
      await iconCircle(s, cards[i][0], x + 0.28, y + 0.28, 0.6, EMERALD, WHITE);
      s.addText(cards[i][1], { x: x + 1.0, y: y + 0.28, w: cw - 1.2, h: 0.6, fontFace: FB, bold: true, fontSize: 13.5, color: INK, valign: "middle", margin: 0 });
      s.addText(cards[i][2], { x: x + 0.28, y: y + 0.95, w: cw - 0.56, h: 0.7, fontFace: FB, fontSize: 11.5, color: SLATE, margin: 0 });
    }
    s.addText(
      [{ text: "Why you care:  ", options: { bold: true, color: EMERALD } },
       { text: "a clean, standards-valid file underwrites faster and bounces less — lowering your cost per loan.", options: { color: INK } }],
      { x: M, y: 6.35, w: PW - 2 * M, h: 0.5, fontFace: FB, fontSize: 14, italic: true, margin: 0 });
    footer(s, 8);
  }

  // ---------- S9 — STAGE 5: DUAL AUS ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 5 · Dual AUS", "DU and LPA — findings captured before delivery");
    const cols = [
      ["FaUniversity", "Desktop Underwriter (DU)", "Fannie Mae", ["Casefile assembled from the verified file", "DU-12.1-shaped findings captured", "Day-1-Certainty-style commitment output"]],
      ["FaUniversity", "Loan Product Advisor (LPA)", "Freddie Mac", ["Second agency leg run in parallel", "Findings reconciled against the DU read", "Broadens the wholesale channels you can serve"]],
    ];
    for (let i = 0; i < 2; i++) {
      const x = M + i * (6.0 + 0.3), w = 6.0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.95, w, h: 3.7, rectRadius: 0.12, fill: { color: i ? EMER_TINT : ROYAL_TINT }, shadow: shadow() });
      await iconCircle(s, cols[i][0], x + 0.35, 2.3, 0.75, i ? EMERALD : ROYAL, WHITE);
      s.addText(cols[i][1], { x: x + 1.25, y: 2.32, w: w - 1.5, h: 0.4, fontFace: FB, bold: true, fontSize: 17, color: INK, margin: 0 });
      s.addText(cols[i][2], { x: x + 1.25, y: 2.72, w: w - 1.5, h: 0.3, fontFace: FB, fontSize: 12, color: SLATE, margin: 0 });
      let y = 3.45;
      for (const li of cols[i][3]) {
        s.addImage({ data: await icon("FaCheckCircle", i ? EMERALD : ROYAL), x: x + 0.4, y: y + 0.03, w: 0.24, h: 0.24 });
        s.addText(li, { x: x + 0.8, y, w: w - 1.15, h: 0.55, fontFace: FB, fontSize: 13, color: INK, valign: "top", margin: 0 });
        y += 0.62;
      }
    }
    // honesty note
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.95, w: PW - 2 * M, h: 0.7, rectRadius: 0.08, fill: { color: "FBF5E7" } });
    s.addImage({ data: await icon("FaInfoCircle", GOLD), x: M + 0.25, y: 6.12, w: 0.32, h: 0.32 });
    s.addText("The AUS legs run as deterministic simulations behind production adapters today; they switch to live DU/LPA the day Homiquity is credentialed — the integration seam is already built.", { x: M + 0.75, y: 5.95, w: PW - 2 * M - 1.0, h: 0.7, fontFace: FB, fontSize: 11.5, italic: true, color: "6B5A2B", valign: "middle", margin: 0 });
    footer(s, 9);
  }

  // ---------- S10 — STAGE 6: WHOLESALE DELIVERY ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Stage 6 · Deliver", "Submission-ready, into your TPO channel");
    s.addText("A target shortlist of wholesale partners, a real submission state machine, and a readiness gate that won't let a file go until it's clean.", { x: M, y: 1.7, w: PW - 2 * M, h: 0.5, fontFace: FB, fontSize: 14, color: INK, margin: 0 });
    // lender chips
    const lenders = ["United Wholesale Mortgage", "Rocket Pro TPO", "Plaza Home Mortgage", "Angel Oak", "Newrez Wholesale"];
    let lx = M, ly = 2.45;
    for (const L of lenders) {
      const w = 0.28 + L.length * 0.098;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: lx, y: ly, w, h: 0.5, rectRadius: 0.25, fill: { color: ROYAL_TINT } });
      s.addText(L, { x: lx, y: ly, w, h: 0.5, fontFace: FB, fontSize: 12.5, bold: true, color: ROYAL, align: "center", valign: "middle", margin: 0 });
      lx += w + 0.25;
    }
    s.addText("Target-5 shortlist · DU + LPA channels", { x: M, y: 3.05, w: 8, h: 0.3, fontFace: FB, italic: true, fontSize: 11.5, color: SLATE, margin: 0 });
    // status machine flow
    s.addText("SUBMISSION STATUS — TRACKED END TO END", { x: M, y: 3.65, w: 10, h: 0.3, fontFace: FB, bold: true, fontSize: 11, color: EMERALD, charSpacing: 1.5, margin: 0 });
    const states = ["Submitted", "Acknowledged", "In underwriting", "Conditions", "Clear to close", "Funded"];
    const n = states.length, gp = 0.3, tw = PW - 2 * M, cw = (tw - gp * (n - 1)) / n, y = 4.05;
    for (let i = 0; i < n; i++) {
      const x = M + i * (cw + gp), last = i === n - 1;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: 0.75, rectRadius: 0.09, fill: { color: last ? EMERALD : MUTED } });
      s.addText(states[i], { x: x + 0.05, y, w: cw - 0.1, h: 0.75, fontFace: FB, bold: true, fontSize: 11.5, color: last ? WHITE : INK, align: "center", valign: "middle", margin: 0 });
      if (i < n - 1) s.addImage({ data: await icon("FaChevronRight", "AAB4C4"), x: x + cw + (gp - 0.18) / 2, y: y + 0.28, w: 0.18, h: 0.18 });
    }
    // readiness gate note
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.15, w: PW - 2 * M, h: 0.95, rectRadius: 0.1, fill: { color: INK } });
    await iconCircle(s, "FaShieldAlt", M + 0.28, 5.35, 0.55, EMERALD_BR, INK);
    s.addText(
      [{ text: "Readiness-gated.  ", options: { bold: true, color: EMERALD_BR } },
       { text: "Every submission carries a snapshot of what we believed about the file at the moment we sent it — a built-in audit trail for both sides.", options: { color: "E6ECFA" } }],
      { x: M + 1.05, y: 5.15, w: PW - 2 * M - 1.3, h: 0.95, fontFace: FB, fontSize: 13, color: WHITE, valign: "middle", margin: 0 });
    s.addText("Lender shortlist is business-development data; the submission adapter is a deterministic simulation until a signed broker agreement exists.", { x: M, y: 6.25, w: PW - 2 * M, h: 0.4, fontFace: FB, italic: true, fontSize: 10.5, color: SLATE, margin: 0 });
    footer(s, 10);
  }

  // ---------- S11 — SEE IT LIVE: borrower experience (real screenshots) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "See it live — real product", "The borrower experience");
    screenshotCard(s, `${SHOTS}/01-landing.png`, 0.6, 1.75, 5.9, "Persona funnel + free decision tools — consented borrowers, captured early");
    screenshotCard(s, `${SHOTS}/07-loan-options.png`, 6.9, 1.75, 5.9, "Instant, deterministic pre-approval read — with the Reg Z anti-steering disclosure");
    footer(s, 11);
  }

  // ---------- S12 — SEE IT LIVE: the broker's desk (real screenshots) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "See it live — real product", "The broker's desk");
    screenshotCard(s, `${SHOTS}/08-lo-command-center.png`, 0.6, 1.75, 5.9, "No-Stall pipeline — one-click Export MISMO, submit to lender, lock the rate");
    screenshotCard(s, `${SHOTS}/10-borrower-file-deck.png`, 6.9, 1.75, 5.9, "The lender-ready file — MISMO 3.4 export, SSN vaulted (last-4), LTV/DTI");
    footer(s, 12);
  }

  // ---------- S11 — WHY LENDERS WIN ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "The value to you", "Three reasons a lender says yes");
    const pillars = [
      ["FaClipboardCheck", "Clean files", "Standards-valid, pre-flighted packages underwrite faster and bounce less — lower cost per loan, higher pull-through.", EMERALD, EMER_TINT],
      ["FaChartLine", "Volume", "A purpose-built funnel feeds you a steady flow of qualified, consented borrowers you didn't have to source.", ROYAL, ROYAL_TINT],
      ["FaBolt", "Velocity", "Certainty and speed compress the path from intake to submission — less fallout, faster funding.", EMERALD, EMER_TINT],
    ];
    const cw = (PW - 2 * M - 2 * 0.4) / 3, y = 2.1, ch = 4.1;
    for (let i = 0; i < 3; i++) {
      const x = M + i * (cw + 0.4);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.14, fill: { color: pillars[i][4] }, shadow: shadow() });
      await iconCircle(s, pillars[i][0], x + (cw - 1.0) / 2, y + 0.5, 1.0, pillars[i][3], WHITE);
      s.addText(pillars[i][1], { x, y: y + 1.75, w: cw, h: 0.5, fontFace: FH, bold: true, fontSize: 22, color: INK, align: "center", margin: 0 });
      s.addText(pillars[i][2], { x: x + 0.35, y: y + 2.4, w: cw - 0.7, h: 1.5, fontFace: FB, fontSize: 13.5, color: SLATE, align: "center", lineSpacingMultiple: 1.1, margin: 0 });
    }
    footer(s, 13);
  }

  // ---------- S12 — COMPLIANCE & TRUST ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Compliance & trust", "Built compliance-first, not bolted on");
    const items = [
      ["FaBalanceScale", "Deterministic engine", "Auditable decisions; no AI in the lending decision, ever."],
      ["FaLock", "PII through a vault", "SSNs stored as ciphertext + last-4, decrypted only at the delivery seam."],
      ["FaClipboardCheck", "Audit log everywhere", "Every PII touch and file action is recorded for the record."],
      ["FaUniversity", "Fannie-Mae-grounded", "MISMO/ULDD terms verified against the official spec — never invented."],
      ["FaFileSignature", "Correct NMLS identity", "The company identifier — NMLS #427468 — prints on every package today."],
      ["FaShieldAlt", "The package makes no promises", "Neutral validation language — no approval or eligibility claims."],
    ];
    const cols = 2, cw = (PW - 2 * M - 0.5) / 2, ch = 1.25, gp = 0.35, gx = M, gy = 1.85;
    for (let i = 0; i < items.length; i++) {
      const x = gx + (i % cols) * (cw + 0.5), y = gy + Math.floor(i / cols) * (ch + gp);
      await iconCircle(s, items[i][0], x, y + 0.15, 0.7, i % 2 ? ROYAL : EMERALD, WHITE);
      s.addText(items[i][1], { x: x + 0.95, y: y + 0.05, w: cw - 1.05, h: 0.4, fontFace: FB, bold: true, fontSize: 15, color: INK, margin: 0 });
      s.addText(items[i][2], { x: x + 0.95, y: y + 0.44, w: cw - 1.05, h: 0.7, fontFace: FB, fontSize: 12.5, color: SLATE, margin: 0 });
    }
    await veteranMark(s, M, 6.55, false);
    footer(s, 14);
  }

  // ---------- S13 — BUILT & READY (honest status) ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Status", "Built and validated today — live on credentialing");
    // left: working today
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.95, w: 5.85, h: 4.35, rectRadius: 0.12, fill: { color: EMER_TINT }, shadow: shadow() });
    await iconCircle(s, "FaCheckCircle", M + 0.35, 2.3, 0.6, EMERALD, WHITE);
    s.addText("Working end to end now", { x: M + 1.1, y: 2.3, w: 4.6, h: 0.6, fontFace: FB, bold: true, fontSize: 17, color: INK, valign: "middle", margin: 0 });
    let y = 3.2;
    for (const t of ["Full intake → decision → package → delivery loop", "MISMO 3.4 / ULDD-valid export", "Deterministic underwriting + dual-AUS legs", "Compliance engines (QM, SFC, edit mirror)", "Every vendor call runs behind a production adapter"]) {
      s.addImage({ data: await icon("FaCheckCircle", EMERALD), x: M + 0.4, y: y + 0.02, w: 0.22, h: 0.22 });
      s.addText(t, { x: M + 0.78, y, w: 4.85, h: 0.5, fontFace: FB, fontSize: 13, color: INK, margin: 0 });
      y += 0.6;
    }
    // right: go-live
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.95, y: 1.95, w: 5.65, h: 4.35, rectRadius: 0.12, fill: { color: ROYAL_TINT }, shadow: shadow() });
    await iconCircle(s, "FaBolt", 7.3, 2.3, 0.6, ROYAL, WHITE);
    s.addText("What makes it live", { x: 8.05, y: 2.3, w: 4.4, h: 0.6, fontFace: FB, bold: true, fontSize: 17, color: INK, valign: "middle", margin: 0 });
    y = 3.2;
    for (const t of ["NMLS licensing — DONE (#427468, Illinois; additional states as licenses issue)", "A signed broker agreement with your channel", "One adapter swap per vendor (credit, DU/LPA, AVM)", "Ops keys (email, storage) — a day of setup"]) {
      s.addImage({ data: await icon("FaArrowRight", ROYAL), x: 7.35, y: y + 0.02, w: 0.22, h: 0.22 });
      s.addText(t, { x: 7.73, y, w: 4.7, h: 0.5, fontFace: FB, fontSize: 13, color: INK, margin: 0 });
      y += 0.62;
    }
    s.addText("Every integration seam is already in place — going live is configuration, not a rebuild.", { x: 7.3, y: 5.75, w: 4.95, h: 0.5, fontFace: FB, italic: true, fontSize: 12, color: ROYAL, margin: 0 });
    footer(s, 15);
  }

  // ---------- S14 — THE ASK (dark royal) ----------
  {
    const s = pres.addSlide();
    s.background = { color: ROYAL_DEEP };
    s.addShape(pres.shapes.OVAL, { x: -1.5, y: 4.6, w: 4.4, h: 4.4, fill: { color: ROYAL, transparency: 35 } });
    s.addShape(pres.shapes.OVAL, { x: 11.4, y: -1.3, w: 3.4, h: 3.4, fill: { color: EMERALD_BR, transparency: 60 } });
    s.addText("THE ASK", { x: M, y: 1.35, w: 8, h: 0.35, fontFace: FB, bold: true, fontSize: 13, color: EMERALD_BR, charSpacing: 3, margin: 0 });
    s.addText("Credential us on your\nTPO channel.", { x: M, y: 1.8, w: 11, h: 1.8, fontFace: FH, bold: true, fontSize: 40, color: WHITE, lineSpacingMultiple: 1.0, margin: 0 });
    s.addText("The platform is built and validated. We're licensed — NMLS 427468, Illinois. Let's set up a live pilot — and prove first-pass, standards-valid delivery on real files.", { x: M, y: 3.75, w: 10.5, h: 1.1, fontFace: FB, fontSize: 17, color: "D5DEF5", lineSpacingMultiple: 1.1, margin: 0 });
    // contact card (placeholders flagged)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.15, w: 8.4, h: 1.5, rectRadius: 0.12, fill: { color: WHITE } });
    s.addText([
      { text: "Homiquity Mortgage Corporation", options: { bold: true, color: INK, fontSize: 16, breakLine: true } },
      { text: "Ammre Barakat, Founder", options: { color: SLATE, fontSize: 13, breakLine: true } },
      { text: "support@homiquity.com  ·  (224) 400-0531  ·  homiquity.com", options: { color: ROYAL, fontSize: 13, bold: true } },
    ], { x: M + 0.35, y: 5.35, w: 7.8, h: 1.1, fontFace: FB, valign: "middle", margin: 0 });
    s.addText("NMLS #427468  ·  Illinois Residential Mortgage License #3423789", { x: M + 0.35, y: 6.62, w: 6, h: 0.3, fontFace: FB, italic: true, fontSize: 10, color: SLATE, margin: 0 });
    await veteranMark(s, 9.0, 5.5, true);
    s.addText("Confidential — for prospective wholesale-lender partners.", { x: 9.0, y: 6.1, w: 3.6, h: 0.5, fontFace: FB, fontSize: 10, color: "AEBCE0", margin: 0 });
  }

  // ---------- S15 — APPENDIX: under the hood ----------
  {
    const s = pres.addSlide();
    s.background = { color: WHITE };
    slideTitle(s, "Appendix", "Under the hood — architecture & compliance base");
    const rows = [
      ["FaServer", "Adapter architecture", "Every external vendor (credit, DU/LPA, AVM, lender submission) sits behind one adapter function — a single, tested seam that flips from simulation to live per contract."],
      ["FaCogs", "Deterministic core", "The underwriting engine is pure and vendor-free: same inputs, same outcome, with typed error classification."],
      ["FaUniversity", "Fannie Mae reference base", "MISMO 3.4 / ULDD Phase 5, UCD, Special Feature Codes and edit codes are grounded in the official spec set — terminology is verified, never invented."],
      ["FaShieldAlt", "NMLS reference base", "Licensing logic is grounded in the NMLS Policy Guidebook and SAFE-Act mapping — state law controls, discrepancies escalate."],
    ];
    let y = 1.95;
    for (const [ic, h, b] of rows) {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y, w: PW - 2 * M, h: 1.05, rectRadius: 0.1, fill: { color: MUTED } });
      await iconCircle(s, ic, M + 0.28, y + 0.24, 0.58, ROYAL, WHITE);
      s.addText(h, { x: M + 1.15, y: y + 0.12, w: 3.3, h: 0.8, fontFace: FB, bold: true, fontSize: 14, color: INK, valign: "middle", margin: 0 });
      s.addText(b, { x: M + 4.6, y: y + 0.12, w: 7.0, h: 0.8, fontFace: FB, fontSize: 12, color: SLATE, valign: "middle", margin: 0 });
      y += 1.2;
    }
    footer(s, 17);
  }

  await pres.writeFile({ fileName: OUT });
  console.log("WROTE " + OUT);
}
module.exports = { build, pres, PW, PH };
if (require.main === module) {
  build().catch(e => { console.error(e); process.exit(1); });
}
