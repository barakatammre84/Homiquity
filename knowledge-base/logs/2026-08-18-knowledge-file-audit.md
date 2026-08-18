# Knowledge-file audit — the Better-teardown corpus vs the repo knowledge base

**2026-08-18 · commissioned by the founder** (operating-playbook Part 2, Step 1: classify every
knowledge file, produce a manifest, delete nothing). Repo audited at `3287f3c`
(`origin/main` tip when the branch was cut). **This is the manifest only** — no file was deleted,
merged, or rewritten by this session; Step 2 (consolidation) waits on founder approval of this
document, per the playbook's own sequence.

**Inputs.** Five uploads: `HOMIQUITY-PROJECT-KNOWLEDGE.md` (standalone, md5 `12beb3e4`),
`HOMIQUITY-OPERATING-PLAYBOOK.md` (md5 `90f36a9d`), `homiquity-components-preview.html`
(md5 `b45f2e9d`), and two zips — `homiquity-better-teardown-package.zip` (18 files) and
`…package_1.zip` (23 files). Both archives verified intact (`unzip -t`: no errors; zero empty or
unreadable files). Plus: the live CCR scheduled-trigger list, the repo's own guards
(`pnpm guard:kb`, `pnpm guard:docs`), and targeted code verification of every load-bearing claim.

**Boundaries (what this audit could not see).** (a) The desktop Claude Project's *full* knowledge
list — only the five uploads are visible; if the project holds older files beyond these, they are
unaudited. (b) The live site — `homiquity-production.up.railway.app` and `www.homiquity.com` both
returned `000` from this session's network policy, so prod-surface claims are verified against
**code at HEAD**, not the deployed DOM; the
[2026-08-18 evening triage](../routines/reports/2026-08-18-evening-triage.md) is cited where prod
state matters. (c) The ten local-scheduler routine definitions in `~/.claude/scheduled-tasks/` on the founder's
machine — cited from [`../routines/CHARTER.md`](../routines/CHARTER.md) §3 and the 08-18 triage's
direct scheduler read, not re-verified from here.

---

## 0. Verdict summary

- **The incoming corpus is largely CANONICAL and genuinely new** — the walkthrough evidence, the
  copy/interaction patterns, the four-question standard, and the component API exist nowhere in the
  repo. But it ships **one stale duplicate** (the standalone knowledge doc is the *older* revision;
  the `_1` zip carries the newer one with §12), **one superseded zip**, and **four factual claims
  the code refutes** (§3 below) — including the claim its own component code is built on (the
  "-subtle tokens aren't mapped into Tailwind" premise is false at HEAD).
- **The repo knowledge base is clean by its own machines**: `guard:kb` — 150 docs, all indexed, no
  dead links; `guard:docs` — 6 living docs within freshness interval. The old-name sweep found
  `MortgageStream` only in archived/dated history and explicitly-bannered historical rows, which is
  correct, plus one false positive (`server/services/apr.ts` `MortgageStreamParams` — a *payment
  stream* domain term, not the repo name; leave it).
- **The routine cleanup already worked**: the four stale app-UI tasks the playbook says to delete
  are **absent from the live trigger list** (seven triggers remain: the four new ones, the PR sync
  loop, Barakat RE triage, one transient `send_later`). The playbook's own Part 1 "delete these
  yourself" row is therefore already stale — in the good direction.
- **The sharpest finding is about the four NEW routines**: two of them re-create the exact failure
  the playbook's doctrine #1 names — a routine carrying **its own private copy of the world**
  instead of a pointer to the knowledge base. The new *monthly financial architecture audit* does
  not invoke the repo's existing `/financial-audit` routine (rails R1–R12, the F-### ledger, the
  collision protocol) and will re-derive findings the ledger already holds; the new *weekly UX
  audit* carries a private defect list instead of pointing at the feature-review register, and
  requests `access="push"` for a report-only job. §5 has the fixes.
- **Nothing in the incoming corpus outranks launch order**: teardown work is acceptance-question-B
  material ([`CHARTER.md`](../routines/CHARTER.md) §1) and slots behind the §2 question-A blockers
  (F-080 and friends). Its "Agreement" question already has three open repo findings wearing its
  shape (F-076/F-077/F-078 → `CTO_ROADMAP.md` §3.18–3.20).

---

## 1. Manifest A — the incoming corpus (the desktop project's files)

| File | Verdict | Action (Step 2, on approval) | Reason |
|---|---|---|---|
| `HOMIQUITY-PROJECT-KNOWLEDGE.md` — standalone upload (`12beb3e4`) | **STALE / DUPLICATE** | Delete from project knowledge | Byte-identical to the *older* zip's copy; lacks §12 (competitive stance, 14-surface scorecard, four-question gate). The `_1` zip's revision (`2c9ff919`) supersedes it. Keeping both invites the exact two-truths drift this audit exists to kill. |
| `homiquity-better-teardown-package.zip` (18 files) | **STALE / DUPLICATE** | Delete | Strict subset of `_1`: no playbook, no parity roadmap, older knowledge doc. |
| `homiquity-better-teardown-package_1.zip` (23 files) | **CANONICAL container** | Keep; unpack per rows below | The complete 2026-08-18 teardown. |
| ├ `HOMIQUITY-PROJECT-KNOWLEDGE.md` (rev `2c9ff919`) | **CANONICAL** — with §3 corrections | Keep in project knowledge **and** land a copy in the repo (§5.2) | The standing competitive/design context. Four claims corrected against code (§3); corrections ride along when it lands. |
| ├ `HOMIQUITY-OPERATING-PLAYBOOK.md` | **CANONICAL** (ops) | Keep; amend Part 1 | The routine/cadence contract for the desktop side. Part 1's "delete these four" is already done (§4); Part 4's doctrine should *cite* [`routines/CHARTER.md`](../routines/CHARTER.md) §0/§11 and TEAM_PRACTICES rather than re-derive them — the repo learned the same lessons first, with enforcement. |
| ├ `better-teardown-raw-notes.md` (847 lines) | **CANONICAL** — append-only audit trail | Keep; land beside the knowledge doc in the repo | The evidence behind every knowledge-doc claim: baseline captures, 9 walkthrough steps, B1–B5 defect log, the verification pass with its own corrections. Never edited, only appended by future deep-dives. |
| ├ `better-teardown-spec.html`, `homiquity-parity-roadmap.html`, `homiquity-components-preview.html` (+ standalone copy, identical) | **KEEP** — human-facing renderings | Keep for the founder; not knowledge-of-record | Illustrated views of the same content. If the parity roadmap and knowledge-doc §10/§12 ever disagree, **the knowledge doc wins** — declare that in the project instructions. |
| ├ `components/` (11 source files), `preview/demo.tsx`, `lib/utils.ts`, `tailwind.config.cjs` | **NOVEL — destined for the repo, not project knowledge** | Land via the normal PR lane as roadmap-scheduled work, after the §3.1 rework | Code belongs in `client/src`, subject to `ui-components` skill rules, the token guard, WCAG AA, and component tests — not in a chat project's knowledge. `lib/utils.ts` and `tailwind.config.cjs` are throwaways here (repo already has `cn` and the token mappings). |
| ├ `README-START-HERE.md` | **MERGE → delete** | Fold its inventory table into the playbook when Step 2 runs | Pure packing slip. |

**Internal discrepancies inside the package** (cosmetic, fix when landing): `components/README.md`
says "Twelve components" while the knowledge doc §9 and `README-START-HERE.md` say thirteen; the
README's file tree omits `patterns/document-list.tsx`, which exists and is documented in knowledge
doc §7/§9.

**Desktop end state after Step 2** = exactly the playbook's four-file target: knowledge doc
(rev `2c9ff919`), playbook, raw notes, `components/README.md` (optional) — each with the date /
purpose / supersedes header the playbook prescribes, and the knowledge doc carrying one added line:
*the repo copy is the citable original; on conflict the repo wins.*

---

## 2. Manifest B — the repo knowledge corpus (191 tracked `.md` files)

Machine verdicts first: **`pnpm guard:kb` — 150 KB docs, all indexed, no dead links. `pnpm
guard:docs` — 6 living docs verified within interval.** The repo already enforces continuously what
the playbook's quarterly audit does by hand; the quarterly re-run (playbook Part 3) is still worth
keeping for the things guards can't see (semantic staleness, routine drift).

| Directory / file set | Files | Verdict | Notes |
|---|---|---|---|
| `knowledge-base/` living docs (handbook, governance, runbooks, compliance, specs, feature-review, routines, financial-audit, primary-engineer, refactor-radar, compliance-watch, research, L1/L2/README) | ~100 | **CANONICAL / KEEP** | Indexed, guard-fresh, precedence-governed (L1→L2→L3, code wins). Exceptions in §2a. |
| `knowledge-base/logs/` + `routines/reports/` | 33 | **KEEP — immutable dated history** | Old names and superseded claims inside them are *correct history*, not rot (TEAM_PRACTICES §2). |
| `knowledge-base/archive/` | 33 | **KEEP — quarantined** | "Never act on these" is declared at the top of the section. Old-name hits concentrate here, as they should. |
| Root: `CLAUDE.md`, `README.md`, `CTO_ROADMAP.md`, `PRODUCT_SPINE.md` (stub), `SESSION_CLAIMS.md` (stub) | 5 | **KEEP** | One known-stale clause in `CLAUDE.md` — already founder-queued, see §2a. |
| `docs/*/README.md` + references | 12 | **KEEP** | Authority-corpus indexes; out of scope for content review here. |
| `.claude/skills/` (10) + `.claude/agents/` (6) + `.agents/skills/` (5) | 21 | **KEEP** | No old-name or dead-routine references found (`sprint-blitz` correctly absent; `SESSION_CLAIMS` cited only as absorbed/stub). |
| `attached_assets/lifestyle/CREDITS.md`, `demo/lender-demo/*` | 3 | **KEEP** | CREDITS.md is load-bearing (feeds roadmap §1.7's Fair-Housing counsel ask). |

### 2a. Exceptions — the stale-claims register (living docs only)

1. **`CLAUDE.md` Reg Z clause — stale, founder-gated.** "Every authoritative source … is blocked
   from this environment" was refuted 2026-08-17 by two independent agents (200s from
   `consumerfinance.gov`, the eCFR versioner API, `law.cornell.edu`; only eCFR HTML blocked). The
   amendment is deliberately **not** made here: it is a binding project rule a session may not
   amend unasked, and it already sits on the founder's desk as roadmap **§1.12** (review dates
   started **today**). This audit adds nothing but the cross-reference. *(This session's own
   probes add a data point: from the CCR network policy, even the Railway prod host is
   unreachable — "blocked" is environment-dependent, which is §1.12's point.)*
2. **`MortgageStream` residue — clean.** Non-archive hits are all deliberate history:
   `runbooks/CICD.md:4-7` (explicit former-name banner), `CHANGE_LEDGER.md` historical rows,
   `feature-review/FINDINGS.md` PR links (GitHub redirects renamed-repo URLs; normalizing them is
   optional cosmetics), `BETA_GO_LIVE_READINESS.md:204` (struck-through moot item),
   `routines/CHARTER.md:28` (documents the rename). False positive to leave alone:
   `server/services/apr.ts` `MortgageStreamParams` / `buildMortgagePaymentStream` — the payment
   stream, not the repo.
3. *(Agent sweep addendum — see §2b.)*

### 2b. Independent sweep results

Two read-only `doc-governance-reviewer` agents were dispatched this session: (a) the incoming
corpus vs the repo's design/UX/competitive docs (contradictions, duplicate coverage, whether the
four-question standard already exists in-repo, archive-quarantine integrity), and (b) the living
docs for defunct-reference staleness (dead-routine instructions, `kb/`-path and platform residue,
clock disagreements). **Their verified results land in this section in the same PR** — dispatched
findings are integrated here only once checked against the code, and anything unverifiable is
marked as such rather than asserted.

<!-- AGENT-RESULTS-PLACEHOLDER -->

---

## 3. Fact corrections to the incoming knowledge doc (code wins — `README.md` precedence rule)

Verified against HEAD `3287f3c`. These do **not** lower the doc's verdict — its §11 honestly
labels its two diagnoses as diagnoses — but each needs a correction note when the doc lands.

1. **"The `-subtle`, `surface` and `veteran-*` tokens are not mapped into the Tailwind theme, so
   `bg-success-subtle` doesn't exist" — three-quarters false.** `tailwind.config.ts` maps
   `surface` (:57–59), `destructive.subtle` (:70–71), `success.subtle` (:79–80), `warning.subtle`
   (:85–86), `info.subtle` (:91–92). Only **`veteran-*` is genuinely unmapped** — and
   `index.css:130-140` documents that as deliberate containment (seal/VA surfaces only, gold never
   text-bearing). Consequence: the shipped components' arbitrary-value classes
   (`bg-[hsl(var(--success-subtle))]`) and `components/README.md`'s "wire the tokens first"
   section are built on a false premise — the rework in §5.3 replaces them with the semantic
   utilities that already exist. Token *values* in doc §2 match `index.css` exactly (spot-verified
   `--primary 163 94% 24%` :72, `--sidebar 224 71% 24%` :58, the subtle block :122–129, veteran
   :137–140, fonts :141–143, shadows — `hsl(215 25% 10%)` ≡ the doc's `#131820`). Count nit: doc
   says 80 `:root` custom properties; HEAD has 88 (+79 in `.dark`, which exists as claimed,
   `index.css:190`).
2. **B2 (nested interactive controls) — real, live, and *wider* than observed, but the diagnosis
   is off.** The mechanism is not `shadcn <Button>` misuse in one place; it is two patterns:
   `<a>` wrapping `<Button>` on the header phone (`client/src/components/Navigation.tsx:211-221`)
   and wouter `<Link>` wrapping a raw `<button>` — **12 occurrences across 3 files**
   (`Navigation.tsx` ×10, `MobileBottomNav.tsx`, `not-found.tsx`). The `asChild` fix direction
   stands; the grep target is different.
3. **B3 (empty header CTA before auth resolves) — present by design, not by accident.**
   `Navigation.tsx:223-224` renders a shape-reserving skeleton (`h-9 w-20 animate-pulse`) while
   `isLoading`. The observed "unlabeled grey pill" *is* that skeleton. The doc's ask — a labeled
   placeholder or default "Sign in" — is a legitimate enhancement, not a regression fix.
4. **B1 (two 404-ing hero images) — the source assets exist at HEAD and are wired.**
   `attached_assets/lifestyle/{learning-planning,founder-note}.jpg` are imported via
   `client/src/lib/lifestyleImages.ts:14-15` (Vite `@assets` alias → hashed bundle output). A
   hashed URL 404-ing in prod while the source exists is the **stale-deploy failure mode**
   (`CLAUDE.md`; the 2026-08-06 incident class), and the 08-18 evening triage measured prod at
   drift 0 by 12:49Z — after a five-merge morning. Likely already cured; **the next daily
   competitive-brief run is the verification** (it carries this exact check). If it still 404s
   with drift 0, that is a new finding (asset-serving, not build), and worth a feature-review row.
5. **Verified as claimed**, for the record: "How it works" homepage section exists for the
   LoanTracker label-reuse recommendation (`client/src/pages/public/Landing.tsx:251`);
   `class-variance-authority` is already a dependency (`package.json:72` — so landing the
   components adds **zero** new dependencies); no `selectOutstanding`/`actionableNow`-style
   central outstanding-selector exists anywhere in the repo (the §8 architectural rule is genuinely
   unimplemented — by those names; no exhaustive task-derivation audit was run).

---

## 4. Routine audit (playbook Part 3's quarterly step, run early)

**CCR trigger list, read live 2026-08-18 (~14:45Z).** Seven triggers. The four stale app-UI tasks
("Autonomous refactor and debug", "Homiquity UX & SEO audit", daily "Financial architecture
audit", "PR review digest") are **not present** — either already deleted or app-local and invisible
from CCR; either way nothing visible fires at the old repo name. One false alarm pre-empted: the
new triggers' UTC crons match the playbook's local times exactly — scheduler `lastRunAt` values
prove local = UTC-3 today (07:21-local slot ↔ `10:25Z`; 09:22-local triage ↔ `12:22Z`), so
12:00/12:30/13:00Z = 9:00/9:30/10:00 local as the playbook states. **Do not "fix" the crons.**

| Trigger (created) | Cadence | Verdict | Notes |
|---|---|---|---|
| Daily Better.com competitive review (08-18) | daily 12:00Z | **KEEP** — report-only ✓, baseline-pinned ✓, kill-criteria ✓ | Two hardening notes: it fetches `www.homiquity.com`, and CHARTER §2's standing fact is machine-to-machine probes use `homiquity-production.up.railway.app` (three cron sweeps died on `www` DNS); and its Homiquity regression baseline (the B1/B3 image + CTA checks) will go stale the day those fix — it should cite the knowledge doc rather than restate it. |
| Weekly UX audit vs Better standard (08-18) | Wed 13:00Z | **KEEP with rewrite** | Carries a private defect list and private standard — playbook doctrine #1's own anti-pattern. Point it at the knowledge doc (standard) + [`feature-review/FINDINGS.md`](../feature-review/FINDINGS.md) (defect register, where B1–B5 should live as findings); have it *date* standing defects before re-reporting (CHARTER §1's rule). **Over-privileged:** instructs `add_repo access="push"` while mandating "do NOT create PRs — report only"; `read` suffices. |
| Monday logged-in deep-dive reminder (08-18) | Mon 12:30Z | **KEEP** | Human-reminder pattern is right (Claude never logs in; founder drives). Appends to raw notes — consistent with Manifest A. |
| Monthly financial architecture audit (08-18) | 1st, 13:00Z | **KEEP with rewrite — the important one** | Its prompt re-creates from scratch what the repo already runs with rails: [`/financial-audit`](../../.claude/skills/financial-audit/SKILL.md) (R1–R12, memory-first, date-qualified `F-<MMDD>-<NN>` ids, claim-register protocol) + [`financial-audit/LEDGER.md`](../financial-audit/LEDGER.md) + eleven dated audit logs (08-04 → 08-14). A fresh-context CRO prompt will re-discover ledgered findings and mint colliding ids — the exact failure the id scheme exists to prevent. Rewrite to: "invoke `/financial-audit` per the skill; monthly cadence." **Open founder question:** what fires the repo's financial-audit lane now? Its last run is 2026-08-14, it is absent from CHARTER §3's clock, and the deleted daily app task may have been its scheduler. If so, this monthly trigger is its successor and *must* invoke the skill. |
| PR sync & review loop (08-12) | hourly weekdays | **KEEP — untouched** | Playbook already adjudicated. Correctly self-limits (defers to live sessions, flags conflicts to a human). |
| Barakat RE inbox triage (08-08) | weekdays 15:00Z | **KEEP — untouched** | Unrelated to Homiquity; drafts-only rails intact. |
| `send_later` 2026-08-19T00:19Z | one-shot | transient | SendGrid sender-verification follow-up; self-disables after firing. |

**The repo fleet (ten routines, local scheduler, CHARTER-governed)** was health-checked by the
[08-18 evening triage](../routines/reports/2026-08-18-evening-triage.md) from a direct scheduler
read: all ten registered, enabled, recurring crons — plus the sharper §3.24 finding
(lender-delivery-gate fired 08-17 and left no artifact). Not re-verifiable from this session; no
contradiction found between that fleet and the four new triggers *except* the financial-audit
ownership question above. **The two fleets do not know about each other** — the playbook audited 8
app-side routines and never saw the charter's ten; the charter's clock knows nothing of the CCR
four. Step 2 should add one cross-reference each way (a CCR-fleet note in CHARTER §3; a
charter pointer in the playbook Part 1) so the next quarterly audit reads both lists.

---

## 5. Step 2 — staged actions awaiting founder approval

Nothing below was executed. Items marked 🖥 are founder-only (desktop app UI); 🤖 a session can
execute on approval.

1. 🖥 **Desktop project knowledge**: delete the standalone knowledge doc (older rev) and the older
   zip; confirm the four stale scheduled tasks are gone from the app's task list (they are gone
   from CCR); keep the four-file end state (Manifest A). Paste the playbook's Step-3 project
   instructions with one addition: *"The repo's `knowledge-base/` is the canonical home; on any
   conflict with project knowledge, the repo wins — flag the loser."*
2. 🤖 **Land the teardown knowledge in the repo**: `knowledge-base/research/better-teardown/`
   carrying the rev-`2c9ff919` knowledge doc (+ §3 correction banner) and the raw notes
   (append-only), each with the standard header, indexed in
   [`../README.md`](../README.md) same-commit (guard-enforced). Docs-only PR lane.
3. 🤖 **Component landing is engineering, not docs** — a proposed ticket for Evening Triage (which
   holds exclusive `CTO_ROADMAP.md` §0–§3 authority; this session does not touch the roadmap):
   land the 11 component sources under `client/src` **after** rework: swap arbitrary-value classes
   for the existing semantic utilities (§3.1); decide the `veteran-*` mapping question inside the
   `ui-components` skill's containment rules rather than the package's blanket mapping snippet;
   colocated component tests per TEAM_PRACTICES §5.2; `data-testid` coverage; WCAG pass. Zero new
   dependencies (§3.5). Priority per the parity roadmap's own Phase 0/1 and behind §2's
   question-A blockers.
4. 🤖 **Register the teardown's five defects as feature-review findings** (B1 pending-prod-check,
   B2 12-site, B3 enhancement, B4 social proof, B5 positioning line) so the weekly UX trigger has
   a register to cite instead of a private list — dedupe against `FINDINGS.md` first.
5. 🤖 **Rewrite the two world-copy triggers** (`update_trigger`): monthly-financial → invoke
   `/financial-audit`; weekly-UX → cite knowledge doc + findings register, drop `push` for `read`,
   probe the Railway host not `www`. Add the two fleet cross-references (§4).
6. 🖥 **Answer the financial-audit ownership question** (§4) — which mechanism fires the repo lane
   now that the daily app task is gone.

*Proposed-ticket note for tonight's Evening Triage: items 3 and 4 are yours to land or re-rank;
this log is the evidence.*

---

## 6. What was deliberately not done

No deletions anywhere (Step-1 contract). No `CTO_ROADMAP.md` edit (CHARTER §4 — Triage's
exclusive lane). No `CLAUDE.md` amendment (binding rule, founder-gated, §1.12). No claim-register
row (docs-only session; CHARTER §5 requires claims for *code*). No verification of the desktop
project's unseen contents, the `~/.claude/scheduled-tasks/` definitions, or the live DOM (network
policy) — each named in Boundaries with its verification path.
