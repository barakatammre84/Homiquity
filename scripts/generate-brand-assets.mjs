#!/usr/bin/env node
/**
 * Brand asset generator (zero new dependencies).
 *
 * Regenerates every favicon / touch icon / logomark from the two committed
 * masters described in scripts/brand-assets.json, so the marks the site serves
 * can never drift apart from each other again. Before this, client/public/ held
 * FOUR unrelated marks: an orange three-squares placeholder favicon, a green
 * wordmark in og-default.png, an unused hand-drawn roofline in
 * client/src/components/brand/Logo.tsx, and the founder's actual logo — which
 * appeared nowhere. See DESIGN_SYSTEM.md §9 Brand & white-label.
 *
 *   pnpm brand:assets                 regenerate into client/public/
 *   pnpm brand:assets --check         verify only, write nothing (CI mode)
 *   pnpm brand:assets --out /tmp/x    render a preview elsewhere
 *   pnpm brand:assets --no-fit        masters are already tightly cropped
 *
 * Rasterises with headless Chrome, already present on every dev machine here and
 * the highest-fidelity renderer available without adding `sharp` (a native dep)
 * to the tree. If Chrome is missing this fails loudly rather than silently
 * emitting a wrong-looking icon.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "client", "public");
const MANIFEST = path.join(ROOT, "scripts", "brand-assets.json");

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
  if (!found) {
    throw new Error(
      "No Chrome/Chromium found. Set CHROME_PATH, or install Chrome.\n" +
        "Looked in:\n  " + CHROME_CANDIDATES.join("\n  "),
    );
  }
  return found;
}

/**
 * Build the wrapper page Chrome screenshots.
 *
 * Two things here are load-bearing and easy to lose:
 *
 * AUTO-FIT. A logo export carries dead space around the glyph — the supplied
 * masters put the mark on ~34% of their canvas — and neither `object-fit` nor a
 * transform can see it, because the emptiness is inside the image. Left alone a
 * 32px favicon renders a 12px speck. So we measure the real ink from the alpha
 * channel and reframe to it before Chrome paints.
 *
 * TINT. The masters are single-colour marks with a clean alpha channel, so a
 * colour variant is just "keep alpha, replace RGB". That is why the repo carries
 * two files instead of ten: every colour is derived, and they cannot drift apart.
 */
function buildPage({ source, size, pad, bg, tint, fit }) {
  const inset = Math.round(size * pad);
  const box = size - inset * 2;
  const href = encodeURI(`file://${source}`);

  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
  body{background:${bg ?? "transparent"};display:flex;align-items:center;justify-content:center}
  #stage{width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center}
</style>
<div id="stage"><canvas id="c" width="${box}" height="${box}"></canvas></div>
<script>
(function(){
  var TINT = ${tint ? JSON.stringify(tint) : "null"};
  var img = new Image();
  img.onload = function(){
    var w = img.naturalWidth, h = img.naturalHeight;
    var m = document.createElement('canvas'); m.width = w; m.height = h;
    var mx = m.getContext('2d'); mx.clearRect(0,0,w,h); mx.drawImage(img, 0, 0);
    var im = mx.getImageData(0,0,w,h), d = im.data;

    var hasAlpha = false;
    for (var p = 3; p < d.length; p += 4) { if (d[p] < 250) { hasAlpha = true; break; } }

    // MATTE EXTRACTION, only for a master with no real alpha (a JPEG, or a PNG
    // flattened onto white). Thresholding would leave a halo, so recover alpha
    // properly: for ink over white the darkest channel is what the ink covered,
    // hence alpha = 1 - min(r,g,b)/255. Un-premultiplying by that returns the
    // ORIGINAL ink colour, so antialiased edges keep the true hue instead of a
    // washed-out blend, and the mark's enclosed counters become transparent —
    // which is what an icon wants: the page shows through them.
    if (!hasAlpha) {
      for (var i = 0; i < d.length; i += 4) {
        var mn = Math.min(d[i], d[i+1], d[i+2]);
        var a = 1 - mn / 255;
        if (a <= 0.004) { d[i+3] = 0; continue; }
        d[i]   = Math.max(0, Math.min(255, (d[i]   - 255*(1-a)) / a));
        d[i+1] = Math.max(0, Math.min(255, (d[i+1] - 255*(1-a)) / a));
        d[i+2] = Math.max(0, Math.min(255, (d[i+2] - 255*(1-a)) / a));
        d[i+3] = Math.round(a * 255);
      }
    }

    if (TINT) {
      var tr = parseInt(TINT.slice(1,3),16), tg = parseInt(TINT.slice(3,5),16), tb = parseInt(TINT.slice(5,7),16);
      for (var j = 0; j < d.length; j += 4) {
        if (d[j+3] === 0) continue;
        d[j] = tr; d[j+1] = tg; d[j+2] = tb;
      }
    }
    mx.putImageData(im, 0, 0);

    var x0 = 0, y0 = 0, x1 = w, y1 = h;
    if (${fit}) {
      x0 = w; y0 = h; x1 = 0; y1 = 0;
      for (var y=0; y<h; y++) for (var x=0; x<w; x++) {
        if (d[(y*w+x)*4+3] > 12) {
          if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
        }
      }
      if (x1 < x0 || y1 < y0) { x0=0; y0=0; x1=w; y1=h; } else { x1++; y1++; }
    }
    // Square the crop around the ink so the mark is never stretched, plus a hair
    // of padding so edge antialiasing is not clipped by the viewport.
    var bw = x1-x0, bh = y1-y0, s = Math.max(bw, bh) * 1.04;
    var cx = document.getElementById('c').getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(m, x0 - (s-bw)/2, y0 - (s-bh)/2, s, s, 0, 0, ${box}, ${box});
    document.title = 'ready';
  };
  img.src = ${JSON.stringify(href)};
})();
</script>`;
}

function render({ chrome, source, out, size, pad, bg, tint, fit, tmpDir }) {
  const page = path.join(tmpDir, `p-${size}-${path.basename(out)}.html`);
  fs.writeFileSync(page, buildPage({ source, size, pad, bg, tint, fit }));

  execFileSync(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      // Without this a file:// page cannot getImageData() a file:// image — the
      // canvas is tainted and throws SecurityError. Everything above is built on
      // getImageData, so omitting this makes every render fail SILENTLY: onload
      // never finishes and Chrome screenshots a blank page.
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--default-background-color=00000000",
      // Image decode is async; without a virtual-time budget the screenshot can
      // land before onload and write a blank icon.
      "--virtual-time-budget=8000",
      `--window-size=${size},${size}`,
      `--screenshot=${out}`,
      `file://${page}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  if (!fs.existsSync(out)) throw new Error(`Chrome wrote nothing for ${out}`);
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const fit = !argv.includes("--no-fit");
  const outArg = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : null;

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const { sources, tints, outputs } = manifest;

  for (const [key, rel] of Object.entries(sources)) {
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.error(`✗ master "${key}" missing: ${rel}`);
      console.error("  Put the master there, then re-run.");
      process.exit(1);
    }
  }

  const chrome = findChrome();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brand-assets-"));
  const outDir = check
    ? fs.mkdtempSync(path.join(os.tmpdir(), "brand-check-"))
    : outArg
      ? path.resolve(ROOT, outArg)
      : PUBLIC_DIR;

  let drift = 0;
  try {
    for (const o of outputs) {
      if (!o.file) continue;
      const source = path.resolve(ROOT, sources[o.source]);
      const tint = o.tint ? tints[o.tint] : null;
      if (o.tint && !tint) throw new Error(`unknown tint "${o.tint}" for ${o.file}`);

      const out = path.join(outDir, o.file);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      render({
        chrome, source, out,
        size: o.size, pad: o.pad ?? 0, bg: o.background ?? null,
        tint, fit, tmpDir,
      });

      if (check) {
        const committed = path.join(PUBLIC_DIR, o.file);
        const stale =
          !fs.existsSync(committed) ||
          !fs.readFileSync(committed).equals(fs.readFileSync(out));
        if (stale) {
          drift++;
          console.error(`✗ ${o.file} is stale or missing`);
        }
      } else {
        const label = `${o.size}×${o.size}${o.tint ? ` ${tints[o.tint]}` : ""}`;
        console.log(`✓ ${o.file.padEnd(30)} ${label}`);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (check) fs.rmSync(outDir, { recursive: true, force: true });
  }

  if (check) {
    if (drift) {
      console.error(
        `\n${drift} asset(s) out of sync with the masters.\n` +
          "Run: pnpm brand:assets",
      );
      process.exit(1);
    }
    console.log(`✓ ${outputs.filter((o) => o.file).length} brand assets in sync with the masters`);
  }
}

main();
