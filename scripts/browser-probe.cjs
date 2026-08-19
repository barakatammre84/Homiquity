#!/usr/bin/env node
/**
 * Browser probe — see the product, in a real renderer, with zero dependencies.
 *
 * routines/CHARTER.md §10 says: "Never claim a UI change was verified in a
 * browser. The client test lane is happy-dom, which has no layout engine; there
 * is no Playwright, no Storybook and no axe in this repo, and §6 forbids adding
 * one." That rail is honest and it stays — but it cost something real. Every UI
 * fix in this repo ships on a text scan, and `guard:ui` says so itself: it has no
 * layout engine, its className metrics see only literal double-quoted strings, so
 * `unprefixedMultiColGrid` is a PROXY for "breaks at 320px", not a measurement.
 * Nothing here could answer the actual question.
 *
 * This closes that without touching the rail §6 actually protects. It adds NO
 * dependency: Chromium is already on disk (Playwright's browser cache,
 * PLAYWRIGHT_BROWSERS_PATH), and Node 22 ships a WebSocket client in core — so
 * the Chrome DevTools Protocol is reachable with `node` and nothing else.
 * package.json is untouched. `pnpm-lock.yaml` is untouched.
 *
 *   node scripts/browser-probe.cjs --url http://localhost:5001/rates --width 320
 *   node scripts/browser-probe.cjs --url <url> --out /tmp/shot.png --full-page
 *   node scripts/browser-probe.cjs --url <url> --expr "document.querySelectorAll('[data-testid]').length"
 *
 * Exit 1 on: no browser, no server, a page error, or a failed built-in check.
 *
 * BUILT-IN CHECKS (the ones a text scan cannot make):
 *   • horizontal overflow at the requested width — DESIGN_SYSTEM §12.3's real
 *     question, not its proxy
 *   • images that failed to load (naturalWidth 0) — a broken asset, distinct
 *     from a stale deploy: compare /api/health's commit before calling it new
 *   • interactive elements below the 44px touch-target minimum (§11)
 *   • icon-only controls with no accessible name (§11)
 *
 * WHAT IT STILL CANNOT DO, and what §10 therefore still forbids claiming:
 * it does not measure contrast ratios, it is not an accessibility audit, and one
 * viewport is not "mobile verified". It renders the page and answers the four
 * questions above. Report the command you ran and what it printed — that is the
 * evidence standard, and it is the only thing that turns "verified in a browser"
 * from a claim into a fact.
 */
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// ------------------------------------------------------------------ args ---
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const URL_ARG = arg("url");
const WIDTH = Number(arg("width", "1280"));
const HEIGHT = Number(arg("height", "900"));
const OUT = arg("out");
const EXPR = arg("expr");
const TIMEOUT_MS = Number(arg("timeout", "30000"));
const MOBILE = WIDTH <= 480 || flag("mobile");

if (!URL_ARG) {
  console.error("browser-probe: --url is required.\n" + "  node scripts/browser-probe.cjs --url http://localhost:5001/ --width 320");
  process.exit(1);
}

// --------------------------------------------------------------- browser ---
/**
 * Chromium on disk, in preference order. Never downloads anything.
 *
 * FIXED 2026-08-18. As written this function could not find a browser on the
 * machine it was written for. Three independent reasons, each sufficient alone:
 *
 *   1. It read $PLAYWRIGHT_BROWSERS_PATH but never the DEFAULT cache location
 *      Playwright actually installs into — `~/Library/Caches/ms-playwright` on
 *      macOS, `~/.cache/ms-playwright` elsewhere. That variable is unset on a
 *      normal dev machine, so the whole branch was skipped.
 *   2. Its relative paths were x64/Linux-shaped. The real layout on Apple
 *      Silicon is `chrome-mac-arm64/…` and the binary is named "Google Chrome
 *      for Testing", so even exporting the variable by hand still failed.
 *   3. On macOS `command -v google-chrome` never resolves — Chrome lives in an
 *      .app bundle that is not on PATH.
 *
 * Net effect: every UI verification fell back to a text scan, which is the exact
 * gap this file's header says it exists to close. A probe nobody can run is a
 * guard with no artifact (routines/LESSONS.md 2026-08-12).
 */
function findChrome() {
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;

  // Playwright's browser cache: the explicit override first, then the platform
  // defaults it installs into when nobody sets one.
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.platform === "darwin" && path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
  ].filter(Boolean);

  // Headless shell first where present: same renderer, smaller and faster to start.
  const rels = [
    "chrome-headless-shell-mac-arm64/chrome-headless-shell",
    "chrome-headless-shell-mac-x64/chrome-headless-shell",
    "chrome-headless-shell-linux64/chrome-headless-shell",
    "chrome-linux/headless_shell",
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    "chrome-linux/chrome",
  ];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs
      .readdirSync(root)
      .filter((d) => d.startsWith("chromium"))
      .sort()
      .reverse();
    // Two passes so a headless shell in ANY versioned dir beats a full Chromium
    // in another — preference is by binary kind, not by directory order.
    for (const rel of rels) {
      for (const dir of dirs) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }

  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execSync(`command -v ${name}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (p) return p;
    } catch {
      /* not installed */
    }
  }

  // macOS app bundles — never on PATH, and the common case on a founder's Mac.
  // Safe to drive: launch() passes --headless=new with an isolated user-data-dir,
  // so this never touches the user's real profile or opens a window.
  for (const app of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ]) {
    if (fs.existsSync(app)) return app;
  }

  return null;
}

const CHROME = findChrome();
if (!CHROME) {
  // Absence is an error, never a silent pass — the guard-with-no-artifact trap
  // (routines/LESSONS.md 2026-08-12). A probe that finds no browser has verified
  // nothing, and must not be reported as green.
  console.error(
    "browser-probe: no Chromium found. Looked at $CHROMIUM_PATH, $PLAYWRIGHT_BROWSERS_PATH,\n" +
      "  the default Playwright cache (~/Library/Caches/ms-playwright, ~/.cache/ms-playwright),\n" +
      "  PATH, and the macOS app bundles.\n" +
      "  This runs where a browser already exists (a cloud session, a dev machine with Chrome).\n" +
      "  Do NOT install one into this repo — CHARTER §6: no new dependencies."
  );
  process.exit(1);
}

// ------------------------------------------------------------------- CDP ---
function launch() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-probe-"));
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "--no-sandbox", // containers run as root; there is no untrusted page here
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--no-first-run",
      "--disable-extensions",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  return new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`browser did not report a DevTools endpoint in 15s:\n${stderr}`)), 15000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const m = /ws:\/\/[^\s]+/.exec(stderr);
      if (m) {
        clearTimeout(timer);
        resolve({ child, wsUrl: m[0], userDataDir });
      }
    });
    child.on("exit", (code) => reject(new Error(`browser exited early (${code}):\n${stderr}`)));
  });
}

/** Minimal CDP client over Node's built-in WebSocket. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? "")})`)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  });
  return {
    ready: new Promise((res, rej) => {
      ws.addEventListener("open", () => res());
      ws.addEventListener("error", () => rej(new Error("could not open the DevTools WebSocket")));
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    close: () => ws.close(),
  };
}

// ------------------------------------------------- in-page check payload ---
/**
 * Runs inside the page. Kept as a single expression string on purpose — CDP's
 * Runtime.evaluate takes source text, and shipping it as one auditable block
 * beats assembling it from fragments.
 */
const CHECKS = `(() => {
  const px = (v) => Math.round(v * 10) / 10;
  // FIXED 2026-08-18: this compared scrollWidth against window.innerWidth, and
  // when the overflow is caused by a min-width or a fixed-width element the
  // LAYOUT VIEWPORT widens to match — so both sides grew together and the check
  // could not fail. Measured on /calculators/affordability at --width 320:
  // screen.width 320, innerWidth 336, scrollWidth 336 → reported "no horizontal
  // overflow (336 ≤ 336)" while the page genuinely overflowed by 16px. That is a
  // guard reporting green on the exact defect it exists to catch.
  //
  // The reference must be the width we ASKED for, which under CDP emulation is
  // window.screen.width. Math.min keeps un-emulated (desktop) runs behaving
  // exactly as before, where innerWidth is the narrower of the two.
  const viewportWidth = Math.min(window.innerWidth, window.screen.width);
  const overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    viewportWidth,
    overflows: document.documentElement.scrollWidth > viewportWidth + 1,
    culprits: [],
  };
  if (overflow.overflows) {
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > viewportWidth + 1) {
        overflow.culprits.push({
          tag: el.tagName.toLowerCase(),
          testid: el.getAttribute("data-testid") || null,
          cls: (el.getAttribute("class") || "").slice(0, 120),
          right: px(r.right),
          width: px(r.width),
        });
        if (overflow.culprits.length >= 8) break;
      }
    }
  }
  const brokenImages = [...document.images]
    .filter((img) => img.complete && img.naturalWidth === 0)
    .map((img) => img.getAttribute("src"))
    .slice(0, 20);
  const INTERACTIVE = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link]";
  const smallTargets = [];
  const unnamedIconControls = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // not rendered
    // Not in the accessibility tree, so neither check applies: it has no
    // accessible name BY DESIGN and no screen reader or pointer will reach it.
    // Found 2026-08-18 on /partners, whose spam honeypot is exactly this:
    // off-screen at -9999px, aria-hidden, tabIndex -1. Reporting it as an
    // unnamed control invites someone to "fix" it by adding a label, which
    // would defeat the honeypot. Third false-positive class in this check.
    //
    // NOTE: this whole block lives inside the CHECKS template literal. Never
    // put a backtick in here — even in a comment. Doing exactly that shipped a
    // syntax error to main in #594, and because scripts/ is not typechecked and
    // nothing runs the probe in CI, the gate stayed green while every probe run
    // crashed. Two "all pages clean" sweeps were parsed off a stack trace.
    if (el.closest('[aria-hidden="true"]')) continue;
    if (r.height < 44 || r.width < 44) {
      smallTargets.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || null,
        text: (el.textContent || "").trim().slice(0, 40),
        w: px(r.width),
        h: px(r.height),
      });
    }
    // Accessible name, in roughly the order the accname spec resolves it.
    //
    // FIXED 2026-08-18 (second defect in this check, found the same day as the
    // overflow one above). It read aria-label / title / textContent ONLY, so a
    // correctly-labelled <input id=x> + <Label htmlFor=x> came back "unnamed":
    // nine false positives across five public pages on the first real sweep and
    // ZERO true ones, four on the affordability calculator alone. CHARTER §10
    // now lets this output be cited as evidence, so over-reporting sends people
    // to fix what is not broken — the guard-that-cries-wolf failure the
    // subMinTouchTarget metric was deliberately narrowed to avoid (#581).
    const labelText = (() => {
      const ref = el.getAttribute("aria-labelledby");
      if (ref) {
        const t = ref.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || "").join(" ").trim();
        if (t) return t;
      }
      if (el.id) {
        const l = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
        if (l && (l.textContent || "").trim()) return (l.textContent || "").trim();
      }
      const wrapping = el.closest("label");
      if (wrapping && (wrapping.textContent || "").trim()) return (wrapping.textContent || "").trim();
      return "";
    })();
    const name = (el.getAttribute("aria-label") || labelText || el.getAttribute("title")
      || el.getAttribute("placeholder") || (el.textContent || "").trim());
    if (!name) {
      unnamedIconControls.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || null,
        cls: (el.getAttribute("class") || "").slice(0, 80),
      });
    }
  }
  return {
    title: document.title,
    overflow,
    brokenImages,
    smallTargets: smallTargets.slice(0, 20),
    smallTargetCount: smallTargets.length,
    unnamedIconControls: unnamedIconControls.slice(0, 20),
    unnamedIconControlCount: unnamedIconControls.length,
  };
})()`;

// ------------------------------------------------------------------ main ---
(async () => {
  const { child, wsUrl, userDataDir } = await launch();
  const cdp = connect(wsUrl);
  await cdp.ready;
  let failed = false;

  const cleanup = () => {
    try { cdp.close(); } catch {}
    try { child.kill(); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  };

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const call = (m, p) => cdp.send(m, p, sessionId);

    await call("Page.enable");
    await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: MOBILE,
    });

    const pageErrors = [];
    cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p?.exceptionDetails?.text || "exception"));

    const loaded = new Promise((resolve) => cdp.on("Page.loadEventFired", resolve));
    await call("Page.navigate", { url: URL_ARG });
    await Promise.race([
      loaded,
      new Promise((_, rej) => setTimeout(() => rej(new Error(`page did not fire load in ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
    ]);
    // The app is a React SPA — load fires before the first render commits.
    await new Promise((r) => setTimeout(r, 1200));

    const { result } = await call("Runtime.evaluate", { expression: CHECKS, returnByValue: true });
    const checks = result.value;

    console.log(`\nbrowser-probe — ${URL_ARG} @ ${WIDTH}×${HEIGHT}${MOBILE ? " (mobile)" : ""}`);
    console.log(`  title: ${JSON.stringify(checks.title)}`);

    if (checks.overflow.overflows) {
      failed = true;
      console.log(`  ✗ HORIZONTAL OVERFLOW: scrollWidth ${checks.overflow.scrollWidth} > viewport ${checks.overflow.viewportWidth}` +
        (checks.overflow.innerWidth !== checks.overflow.viewportWidth
          ? `  (layout viewport widened to ${checks.overflow.innerWidth} — something forces a min-width)`
          : ""));
      for (const c of checks.overflow.culprits) {
        console.log(`      <${c.tag}${c.testid ? ` data-testid="${c.testid}"` : ""}> right=${c.right} width=${c.width}  class="${c.cls}"`);
      }
    } else {
      console.log(`  ✓ no horizontal overflow (scrollWidth ${checks.overflow.scrollWidth} ≤ ${checks.overflow.viewportWidth})`);
    }

    if (checks.brokenImages.length) {
      failed = true;
      console.log(`  ✗ ${checks.brokenImages.length} image(s) failed to load:`);
      for (const src of checks.brokenImages) console.log(`      ${src}`);
      console.log(`      (before calling this new: compare /api/health's commit to origin/main — a hashed-asset 404 with drift > 0 is a stale deploy)`);
    } else {
      console.log(`  ✓ every image loaded (${checks.brokenImages.length === 0 ? "0 broken" : ""})`);
    }

    console.log(`  ${checks.smallTargetCount ? "•" : "✓"} touch targets under 44px: ${checks.smallTargetCount}`);
    for (const t of checks.smallTargets) {
      console.log(`      <${t.tag}${t.testid ? ` data-testid="${t.testid}"` : ""}> ${t.w}×${t.h}  ${JSON.stringify(t.text)}`);
    }
    console.log(`  ${checks.unnamedIconControlCount ? "•" : "✓"} interactive elements with no accessible name: ${checks.unnamedIconControlCount}`);
    for (const t of checks.unnamedIconControls) {
      console.log(`      <${t.tag}${t.testid ? ` data-testid="${t.testid}"` : ""}> class="${t.cls}"`);
    }

    if (pageErrors.length) {
      failed = true;
      console.log(`  ✗ ${pageErrors.length} uncaught page error(s):`);
      for (const e of pageErrors.slice(0, 5)) console.log(`      ${e}`);
    }

    if (EXPR) {
      const { result: r } = await call("Runtime.evaluate", { expression: EXPR, returnByValue: true, awaitPromise: true });
      console.log(`  --expr → ${JSON.stringify(r.value)}`);
    }

    if (OUT) {
      const shot = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: flag("full-page"),
      });
      fs.writeFileSync(OUT, Buffer.from(shot.data, "base64"));
      console.log(`  screenshot → ${OUT}`);
    }

    console.log("");
  } catch (err) {
    console.error(`browser-probe: ${err.message}`);
    failed = true;
  } finally {
    cleanup();
  }
  process.exit(failed ? 1 : 0);
})();
