# Regulatory Monitoring — the Source-of-Truth System

**Purpose:** keep every statutory constant and guideline-derived rule in the platform verifiably aligned with its official source — and make *going stale* or *upstream changes* loud, automatic signals instead of silent drift.

Three tiers, two automated today. **Tier 2's coverage is partial and named below — do not read "automated" as "covered".**

## Tier 1 — The regulatory ledger (automated, live)

[`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json) holds one entry per statutory constant in the codebase: the rule, its value, the exact citation, the **official source URL**, the code location, `lastVerified` date, and a review interval. `scripts/regulatory-freshness.cjs` runs inside `pnpm checkup` and **fails** when any entry is overdue for re-verification, its code reference no longer exists, or the Tier 2 watcher has gone silent.

**The human loop:** when a check fails, open the entry's `sourceUrl`, confirm the value against the official text, then update `lastVerified` (and the value + a `Correction to S-XX` in the [scenarios registry](./UNDERWRITING_SCENARIOS.md) if the guideline changed). Values never change without a citation.

The ledger already surfaces two genuine review items it exists to catch:
- `platform-dti-ceiling-43`: the 43% flag threshold references the repealed Appendix Q QM standard; DU approves up to 50% — decide whether to align.
- `fnma-b3-6-05-deferred-student-loan`: the 1% vs 0.5% (FHA) question, tracked as NC-01.

## Tier 2 — The official-sources change watcher (automated; coverage is partial and named)

`pnpm reg:watch` (persisting variant: `pnpm reg:watch:save`) polls the official sources and diffs
against `data/regulatory/regulatory-watch-state.json`. Detected changes become durable rows in
[`data/regulatory/regulatory-watch-signals.json`](../../data/regulatory/regulatory-watch-signals.json);
`pnpm reg:triage` renders the open ones for adjudication.

**Exit codes** — the watcher may never report coverage it did not have:

| Code | Meaning |
|---|---|
| `0` | complete run, no changes — every configured source observed |
| `2` | changes detected (outranks incompleteness) |
| `3` | **incomplete run** — at least one source unreachable or unusable |
| `1` | the watcher itself failed |

### Source status, probed 2026-08-20

A source counts as observed only if its body contains its own evidence (`contentProbe`) — a
`200` is not an observation.

| Source | Status | Notes |
|---|---|---|
| Federal Register API | **ok** | CFPB + HUD + VA rules and proposed rules, structured |
| VA circulars | **ok** | genuine HTML; circular numbers present in the body |
| Fannie Mae Selling Guide announcements | **unreachable** | HTTP 403 bot wall; has never once succeeded |
| FHA (HUD) Mortgagee Letters | **unreachable** | HTTP 403 bot wall — **regressed**: it hashed fine on 2026-07-04 |
| Freddie Mac Guide bulletins | **unusable** | HTTP 200, but the page is an Oracle RightNow SPA shell — the bulletins are rendered by JS and appear nowhere in the body |

**Real coverage is therefore 2 of 5**, and those three gaps are recorded under
`acknowledgedBlocked` in the state file. That field is the **ratchet**: an acknowledged gap
downgrades to a `WARN` in `pnpm checkup`, while a source going blocked *without* an entry there
turns the gate **red**. The asymmetry is deliberate — three sources only a subscription can fix
would otherwise leave the gate permanently failing, and a gate people learn to skip stops catching
the case that is actually actionable. Removing an entry re-arms the source. Alternatives probed the same day and rejected:
`sf.freddiemac.com/general/{news, guide-bulletins-and-industry-letters}` return a **soft 404**
(HTTP 404 with an 88 KB styled page), and `hud.gov` refuses the whole domain including its RSS.
Re-probe before trusting this table — reachability here is environment-dependent and has flipped
before. These three are **procurement items, not retry targets**: the Tier 3 subscriptions below
are the only channel that currently works for Fannie, Freddie and FHA.

### What the 2026-08-20 rebuild fixed

The watcher had gone silent on **2026-07-04 and nothing noticed for 47 days**, because a monitor
that stops running produces no output to be wrong about. Worse, when it did run it reported
`No regulatory changes detected (4 pages + Federal Register)` while reaching two of those four —
and Freddie's stable SPA-shell digest meant a *reported success* covering every bulletin Freddie
published. Three defects, one shape: an operation that did not happen while the output said it did.

Now: per-source status is persisted, a body without its own evidence is `unusable` and is **not
hashed**, a digest that can no longer be attested to is **dropped** so recovery re-baselines
instead of faking a change, and `scripts/regulatory-freshness.cjs` — which runs offline inside
`pnpm checkup` — **fails** when the watcher has not run in 10 days or a source has produced no
evidence in 14. Pinned by [`tests/regulatoryWatch.test.ts`](../../tests/regulatoryWatch.test.ts),
whose cases were each verified to go red when their guard is removed.

The watcher itself stays **out** of `pnpm checkup`: it makes live network calls, and a gate that
needs the internet fails on a plane.

### Signals → intake (the loop's one automated edge)

Each signal carries `ledgerCandidates`: a **deterministic** match against the 59 entries in the
ledger — by `sourceUrl` host for a publication page, and by the CFR section, regulation letter or
statute a Federal Register **title names explicitly**. A broad notice that names nothing returns
an empty list plus an `authorityScope` blast-radius count, rather than every entry under the
agency: the first run emitted 24 ids for a CFPB Request for Information, and a list that long is a
table of contents, not a finding.

`pnpm reg:triage` prints each open signal with its candidates' current values, `lastVerified`
dates and `codeRef` paths, plus a paste-ready intake block in the
[SCENARIO_ARCHITECT.md](./SCENARIO_ARCHITECT.md) v2 shape — with `rule` left as
`NO CITATION — needs research`, always.

**No script writes the compliance registry.** Promotion of a signal into
[UNDERWRITING_SCENARIO_INTAKE.md](./UNDERWRITING_SCENARIO_INTAKE.md) is authored by a human or the
`/domain-oracle` routine, **with a citation**. A script that could file its own scenario rows
would be a machine authoring credit policy, which CHARTER §6 places at L4, human-only. Dispositions
are recorded (`--promote` / `--dismiss "<reason>"`), never deleted — a row that vanishes is
indistinguishable from one nobody ever saw.

**Not yet scheduled.** The watcher runs on demand today; wiring it into
[`.github/workflows/cron-jobs.yml`](../../.github/workflows/cron-jobs.yml) (and pinning the
expression in `tests/cronSchedules.test.ts`) is held for the live launch.

## Tier 3 — Accounts, subscriptions, and licensed content (your actions — roadmap F10)

- **Subscribe (free, ~15 minutes total):** Fannie Mae Selling Guide notifications, Freddie Mac Guide bulletin emails, FHA INFO announcements, VA lender news. These are the belt to the watcher's suspenders — and the only reliable Fannie channel today.
- **Fannie Mae Developer Portal:** register; public APIs are open, business-partner APIs (Loan Lookup, pricing, DU) unlock with seller/servicer or TSP approval — pairs with F6 (DU access).
- **Licensed compliance content (evaluate later):** AllRegs (ICE) for the licensed guideline corpus; Mavent/ComplianceEase-class engines for loan-level compliance checks. Wholesale lenders recognize these; budget items, not prerequisites.

## The end-state architecture (when scale justifies it)

Statutory constants migrate from code into the **versioned, effective-dated lookup-matrix system** (`lookupResolver`) that pricing already uses — so a guideline update creates a new effective-dated row instead of editing history, and any past decision can be reproduced for an auditor with the rule that governed it *on that date*. Until then, the ledger + invariant tests + git history provide the audit trail.
