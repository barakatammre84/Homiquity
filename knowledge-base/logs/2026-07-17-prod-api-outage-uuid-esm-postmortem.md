# Prod API outage postmortem — ESM-only uuid forced onto a CJS require path — 2026-07-17

> Dated, immutable snapshot ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §2). Never rewritten;
> supersession goes in a banner here. Every fact below cites a live probe, the Vercel API, a commit,
> or code — not another doc. Binding rules extracted from this incident live in
> [CICD.md § Post-deploy health check](../runbooks/CICD.md#post-deploy-health-check-binding--ready-is-not-healthy);
> this file is the evidence they stand on.

## 1. Summary

For roughly 16 minutes on 2026-07-17 (~15:03–15:19 UTC), every `/api/*` route in production
returned `{"error":"Server failed to start", "bootError":"require() of ES Module …/uuid@14.0.1/…
from …/gaxios@6.7.1/…"}` while the static front end kept serving normally. The trigger was a
dependency-hygiene PR ([#219](https://github.com/barakatammre84/MortgageStream/pull/219)
`4eb456a`) that moved the overrides block from npm's top-level `"overrides"` format (which pnpm
silently ignores) to `"pnpm"."overrides"` (which it honors). The uuid override written during the
earlier vulnerability sweep (`524335b`) was a **floor, not a pin** — `"uuid": ">=11.1.1"` — so the
moment it took effect, pnpm resolved uuid to the newest version satisfying it: **uuid@14, which is
ESM-only**. Every consumer in the graph was forced onto it, including `gaxios` (CommonJS, in the
`google-auth-library`/GCS object-storage chain), whose runtime `require("uuid")` crashed the
serverless function at boot. Fixed forward the same day by
[#222](https://github.com/barakatammre84/MortgageStream/pull/222) (`b87d830`): cap the override at
`^11.1.1` — the identical security floor, kept inside the newest major that ships a real CommonJS
build.

## 2. Impact

- **Down:** 100% of `/api/*` in production — login, dashboards, uploads, coach, every dynamic
  surface — from the first READY deploy carrying #219 until the #222 deploy was aliased.
- **Up:** the static client (Vite assets) — the site *looked* fine, which is exactly what made the
  outage invisible to a homepage glance.
- **Window:** ≈16 minutes (~15:03Z → 15:19:34Z). Bounded on the left by the sibling session's
  observation of the first post-quota READY deploy (~15:00–15:03Z) and on the right by a verified
  `GET /api/health` → `{"status":"ok","timestamp":"2026-07-17T15:19:34.622Z"}`.
- **Data:** none lost; the database and migration state were untouched throughout.
- **Detection:** manual — a session probing `/api/health` while handling the founder's
  "redeploy once the quota resets" request. **No automated signal existed or fired.** Had nobody
  probed, the API would have stayed down indefinitely behind a READY deployment.

## 3. Timeline (UTC, 2026-07-17)

| Time | Event | Evidence |
|---|---|---|
| ~14:45 | Vercel Hobby build quota exhausted; PR deploy checks failing "Deployment rate limited — retry in 24 hours". Prod frozen on the last pre-#208 build. | PR #212 Vercel check output |
| 15:02:56 | #219 (`4eb456a`) merged — overrides moved under `pnpm.overrides`; lockfile resolves uuid → 14.0.1 everywhere. | commit; `pnpm-lock.yaml` diff |
| ~15:03 | Quota clears (well under 24h). First READY production deploy carrying #219 goes live — **API now down** (build green; the crash is at runtime `require`). | sibling session's Vercel observation |
| 15:07:40–15:08:59 | #221 deploy `dpl_WwBpC9XgjiDCW2vts4fzhKrnejqL` builds → **READY**, aliased to `homiquity.com` — still broken. | Vercel API `get_deployment` |
| ~15:10 | **Detection:** live probe `GET /api/health` returns the `bootError` JSON naming `uuid@14.0.1` ← `gaxios@6.7.1`. | probe transcript |
| 15:11–15:15 | Root cause isolated: micro-repro of the exact failing statement (`createRequire(<gaxios pkg>)("uuid")` resolves to `uuid@14/dist-node/index.js`); fix authored + verified locally. | #222 PR body |
| 15:17:46 | #222 (`b87d830`) merged on a green gate. | GitHub |
| 15:19:34 | `GET /api/health` → `{"status":"ok"}`; second route (`/api/auth/providers`) returns real data. **Recovered.** | probe transcript |

## 4. Root cause chain

1. `524335b` (dependency-vulnerability sweep) added a top-level `"overrides"` block — **npm's
   format, which pnpm ignores** — containing `"uuid": ">=11.1.1"`. The override was inert from the
   day it was written; nothing ever enforced or exercised it.
2. #219 correctly moved the block to `"pnpm"."overrides"`. The override began applying — for the
   first time, months of registry drift later.
3. `>=11.1.1` is a **floor**. pnpm resolves an override range to the newest satisfying version:
   uuid@14.0.1, whose `dist-node/index.js` is **ESM-only** (uuid ≤11 shipped a dual build with
   `exports.node.require → dist/cjs/index.js`; later majors dropped CJS).
4. Both build scripts bundle with `--packages=external` (`package.json` `build` /
   `vercel-build`), so `gaxios` and `uuid` are **not** baked into the esbuild bundle — the
   function `require()`s them from `node_modules` at runtime.
5. `gaxios@6.7.1` (CJS; pulled by `google-auth-library` for GCS object storage) declares
   `uuid ^9.0.1` but the override forced 14. Its `require("uuid")` threw `ERR_REQUIRE_ESM` inside
   Vercel's function loader → the app's dynamic-import bootstrap caught it and served the readable
   `bootError` JSON (the [CICD.md "readable bootError" design](../runbooks/CICD.md#how-the-vercel-deploy-works)
   worked exactly as intended — it's why the error named the culprit module on the first probe).

## 5. Why every safety net missed it

| Layer | Why it stayed green |
|---|---|
| CI `gate` (typecheck · unit tests · schema guard) | Unit tests never boot the built server or exercise the runtime dependency graph. |
| Local dev (`pnpm dev`) | tsx runs TS directly under local Node; and see the loader row below. |
| Local built-server boot (`node dist/index.js`) | **Verified during diagnosis: it boots fine** — local Node 24.14 supports `require(esm)` (Node ≥22.12), so requiring ESM-only uuid succeeds locally. |
| Vercel build | Green — `vite build` + esbuild complete normally; the failure is at first runtime `require`, after "READY". |
| `pnpm audit` (blocking, in the gate) | uuid@14 carries no advisory — this was a compatibility break, not a vulnerability. |
| Vercel **READY** status | READY attests the *build*, not the runtime. The deployment that was verified "READY, aliased" was serving a 100%-dead API. |
| GitHub "Vercel" commit status | Separately unreliable — it can sit "pending" indefinitely after the deployment is actually READY (observed same day on #208). Never a health signal in either direction. |

**Open question (does not affect the fix):** prod threw the pre-22.12-style `ERR_REQUIRE_ESM`
even though the project pins `nodeVersion: 24.x` — some layer of Vercel's function loader does not
support `require(esm)`. Which layer is unresolved; the fix is valid under every loader because
uuid@11 ships genuine CJS.

## 6. The fix (#222, `b87d830`)

`"uuid": ">=11.1.1"` → `"uuid": "^11.1.1"` — same security floor, capped inside the newest major
with a real CommonJS build. Two-file diff (`package.json` + 7 lockfile hunks). Verified before
merge: the micro-repro resolves to `uuid@11.1.1/dist/cjs/index.js` and loads; the built server
boots with `/api/health` ok; `pnpm audit --prod` clean; full gate green. Prod verified recovered
at 15:19:34Z.

## 7. Binding lessons (enforced via [CICD.md](../runbooks/CICD.md))

1. **READY ≠ healthy.** After every production deploy, probe the app:
   `curl -sL https://www.homiquity.com/api/health` must return `{"status":"ok"}`. A ledger row's
   validation column citing only "deploy READY" is incomplete for any change that can affect the
   server at runtime.
2. **Never write a version floor into `pnpm.overrides`.** Floors auto-upgrade across majors as
   the registry moves — silently, on whatever future day the resolver next runs. Pin exactly or
   cap within a major (`^`), and record why the override exists next to it.
3. **A dependency-graph change is a runtime change.** Lockfile/override PRs must boot the built
   server (`node dist/index.js` with env) — and know that a local boot on modern Node can mask
   `require(esm)` breaks that older loaders (Vercel's included) will hit. When an override
   activates for the first time, diff the lockfile for **major-version jumps**, not just the
   target package.
4. **Verify deploy state via the Vercel API or the app itself**, never via the GitHub "Vercel"
   commit status (stalls pending after READY; also the only non-required check — `gate` is the
   sole merge gate).

## 8. Follow-ups (proposed, not yet built)

- **Automate lesson 1:** a post-merge GitHub Actions step (after `migrate-prod`) that polls prod
  `/api/health` for up to ~5 minutes and fails loudly — turning this postmortem's manual probe
  into a standing tripwire. Until then the check is a manual, binding step in CICD.md.
- Resolve the loader question (§5) if/when Vercel documents `require(esm)` support for its Node 24
  function runtime; until then, treat "ESM-only transitive dep on a CJS require path" as
  prod-breaking regardless of local behavior.
