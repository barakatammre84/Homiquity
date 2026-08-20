# Rent Reporting Watch — 2026-08-20

`STATUS: WARN` — every gate holds and every rent test actually runs; the WARN is that **three of
the four rent ledger entries are blocked on a network premise that is false today**.

---

## ⛔ Human actions

**1. (founder / Compliance Watch) Three rent ledger entries are blocked on a stale premise —
re-probe and capture, don't re-defer.** `fcra-1681s2-furnisher-accuracy`,
`regv-1022-43-dispute-response` and `croa-1679b-advance-payment` each say verbatim verification is
pending because "every authoritative host is blocked from agent environments" (recorded 2026-08-08,
inheriting the 2026-08-04/05 condition). I probed today. Three of those hosts answer with genuine
section text — verified by content, not by status code:

```
ecfr 1022.43            http=200  bytes=17810    grep "direct dispute" → 14
consumerfinance 1022.43 http=200  bytes=166670   grep "direct dispute" → 20
govinfo 15 USC 1681s-2  http=200  bytes=153168   PDF v1.7, 7 pages; streams decompressed to
                                                 241,000 chars: "1681s"×16, "furnisher"×12,
                                                 "Page Not Found"×0
uscode.house.gov        http=000  bytes=0        (still unreachable)
```

This is exactly the flip CLAUDE.md documents ("reachability is environment- and tool-dependent and
has already flipped once — a thing to *test*, never a thing to assert"). The blocker on these three
is now **capture**, not access: nothing lands in `docs/fcra/` until a session writes the files
there. **I did not write them** — `docs/**` and `data/regulatory/**` are off-limits to this routine
(R2), and asserting an FCRA fact is forbidden outright (R5). Ticket T1 below.

**2. (founder) The CDIA Metro 2® manual is still absent — 12 days since the program opened
(2026-08-08).** This one is a *status*, not a failure: the manual is licensed by CDIA to members
and vetted furnishers and is not downloadable at any reachability. Acquisition is a
membership/procurement action a human must complete. `cdia-metro2-base-segment-layout`'s own note
already says so correctly and needs no change.

**3. (founder) Dispute intake still has no owner.** `disputed` is a modeled state with no
operation behind it: receiving and answering an ACDV through e-OSCAR inside the statutory window is
a staffed process that does not exist, and it is a precondition of furnisher registration. Ticket
T3. Unchanged since 2026-08-12 and re-verified today, not repeated from the skill file.

---

## Summary

Every one of the ten invariants holds, re-derived from code rather than from the skill file, and
all eight rent tests are both listed in their config and present in the actual run output — the
node lane is 205 files / 3007 passed, the client lane 110 files / 714 passed, both green. Neither
authority corpus has landed (`docs/cdia-metro2/` and `docs/fcra/` each hold only `README.md`), which
is the designed steady state and not a stall. The one thing that moved is outside the code: three of
the four rent ledger entries justify their pending status with a blocked-network claim that today's
probe falsifies for eCFR, consumerfinance.gov and govinfo, so those readings are now verifiable and
merely uncaptured. Two of the skill file's four "known open" items are stale and are corrected
below — `rent_payments` got its writer in #515 on 2026-08-17, and a sixth rent test
(`tests/rentNavigation.test.ts`) now exists and is registered.

---

## Evidence

### Phase 0 — orient

- `git rev-list --count HEAD..origin/main` → `0`; branch cut from `origin/main` at `53044804`.
- `pnpm install --frozen-lockfile` re-run after checkout → `Done in 4s`.
- `REGISTER.md` active claims: one row, the F-077 FHA pricing leg on
  `server/services/{loanEstimate,loanCosts,…}.ts`. **No claim touches any rent-reporting file.**
  This routine took no claim (R2).
- `ListAgents` → 12 peer sessions, none identifiable as mid-edit on these files.

### Phase 1 — the invariant sweep

| # | Invariant | Verdict | Evidence |
|---|---|---|---|
| I1 | Nothing can furnish | **HOLDS** | `shared/lib/metro2/compiler.ts:33` `FIELD_LAYOUT = []`; `:41` `BASE_SEGMENT_LENGTH = null`; `:57-69` `compileBaseSegment` throws `Metro2FormatError` while unreleased. `server/services/rentFurnishing.ts:226-246` `evaluateProgramReadiness()` pushes all three blockers ⇒ `canFurnish === false`. Pinned green by `tests/rentFurnishing.test.ts:166-168`. |
| I2 | `FURNISHABLE_PROVENANCE === ["platform_processed"]` | **HOLDS** | `rentFurnishing.ts:68`, exactly one member. `bank_observed` and `self_reported` excluded; `:59-64` records why (a fuzzy Plaid keyword match would furnish a MISSED payment for someone who paid). Test-pinned `tests/rentFurnishing.test.ts:94-95`. |
| I3 | Billing off, no processor | **HOLDS** | `rentFurnishing.ts:47` `RENT_REPORTING_BILLING_ENABLED = false`. `grep -in "stripe\|braintree\|paypal\|square\|adyen\|dwolla\|checkout" package.json` → **0 hits**. `plaid`/`react-plaid-link` are present but for verification only — `grep "paymentInitiation\|payment_initiation\|transfer" server/plaid.ts` → **0 hits**. |
| I4 | `BUREAU_MINIMUM_ACTIVE_LINES === null` | **HOLDS** | `rentFurnishing.ts:214`. |
| I5 | `suppressed` terminal, reachable from everywhere | **HOLDS** | `rentFurnishing.ts:133-141`: every one of the five non-terminal states lists `"suppressed"`; `suppressed: []`. |
| I6 | Public page states it is not reporting, no price | **HOLDS** | `client/src/pages/public/RentReporting.tsx:112-117` ("We are not reporting to the credit… This is a waitlist, not a signup. Nothing is being reported, nothing is for sale"); `:163`. No `$`, `/mo` or price string anywhere in the file. |
| I7 | `/my-lease` offers no enrolment control | **HOLDS** | `client/src/pages/borrower/MyLease.tsx:31-33` (documented absence), `:162`, `:189`. |
| I8 | Lease PII round-trips through `encryptionService`, three columns | **HOLDS** | `server/storage/leases.ts:45-51` `encryptTriple`, `:61-72` `decryptTriple` (a decrypt *failure* throws rather than rendering as absent), write paths `:108-121` and `:168-171`. Columns `shared/schema/rent.ts:107-112`. **Note for future readers:** "three columns" means content + iv + **keyId** per encrypted field, not three PII fields — `landlordName` is deliberately plaintext as a business counterparty (`shared/schema/rent.ts:101-106`). No plaintext writer for email/address exists. |
| I9 | Credit monitoring stays staff-side | **HOLDS** | `server/services/creditMonitoring.ts:15-22` — output is a staff task; no notify/SMS/email path in the module. Route `server/routes/jobs.ts:92-112` is cron-secret or `requireRole("admin")` only. |
| I10 | Quarantines hold | **HOLDS** | `grep -c '3A'` → `0` in `shared/lib/metro2/compiler.ts`, `shared/lib/metro2/format.ts`, `server/services/rentFurnishing.ts`. The four `100` hits in `rentFurnishing.ts` (`:36`, `:203`, `:205`, `:241`) are all prose explaining *why the number is not a constant*; no numeric threshold exists. |

**Nothing SKIPPED in Phase 1.**

### Phase 2 — test liveness (the check CI cannot do)

Both halves asserted: registered in the config **and** named in the actual run output.

| test file | in config | in run output | result |
|---|---|---|---|
| `tests/metro2Gate.test.ts` | `vitest.config.ts:256` | RAN | passed |
| `tests/rentFurnishing.test.ts` | `vitest.config.ts:257` | RAN | passed |
| `tests/creditMonitoring.test.ts` | `vitest.config.ts:258` | RAN | passed |
| `tests/rentReportingSurface.test.ts` | `vitest.config.ts:259` | RAN | passed |
| `tests/leaseCapture.test.ts` | `vitest.config.ts:262` | RAN | passed |
| `tests/rentNavigation.test.ts` | `vitest.config.ts:265` | RAN | passed |
| `client/src/pages/borrower/MyLease.test.tsx` | glob `vitest.client.config.ts:37` | RAN | passed |
| `client/src/pages/public/RentReporting.test.tsx` | glob `vitest.client.config.ts:37` | RAN | passed |

Run output is not the summary line — the lanes were re-run under `--reporter=json` and each
filename read back out of `testResults[].name`:

```
node lane:   205 files in run output · success: true · 3007 passed · 0 failed
client lane: 110 files in run output · success: true ·  714 passed · 0 failed
```

**`tests/rentNavigation.test.ts` is new since the skill file was written** (landed `a8463259`,
#540, 2026-08-17) and pins the two rent routes against silent orphaning. It is registered. The
skill file's Phase 2 list should grow to six — noted for whoever next edits it; this routine does
not write `.claude/**`.

**Conditionally-inert assertions, reported as such (R7).** `tests/metro2Gate.test.ts:40` early-
returns while `FIELD_LAYOUT` is empty, and `:49-53` iterates an empty array — so two of that file's
15 cases assert nothing today. This is the self-releasing design, not drift: both arm the instant
the layout is populated, which is the only moment they matter. `grep -nE "\.skip|skipIf|todo\("`
across all eight rent test files returns **no other** conditional skip. The node lane's single
skipped test is outside this program.

### Phase 3 — authority watch

```
$ ls docs/cdia-metro2/
README.md
$ ls docs/fcra/
README.md
```

Neither corpus has landed. **12 days elapsed since 2026-08-08.**

`docs/fcra/README.md` carries the same stale blocked-host list as the ledger entries
(`ecfr.gov`, `consumerfinance.gov`, `govinfo.gov`, `law.cornell.edu`, `uscode.house.gov`,
`federalregister.gov`; "verified 2026-08-04, re-verified 2026-08-05"). Today's probe output is in
⛔ action 1 above. `docs/cdia-metro2/README.md` is **correct as written** and explicitly
distinguishes itself from the Reg Z class ("No amount of network access from inside a session
produces it").

### Phase 4 — ledger freshness

`node scripts/regulatory-freshness.cjs`:

```
SOON  fcra-1681s2-furnisher-accuracy:     due in 2d
SOON  regv-1022-43-dispute-response:      due in 2d
SOON  cdia-metro2-base-segment-layout:    due in 2d
SOON  croa-1679b-advance-payment:         due in 2d
```

**No rent entry is overdue.** All four sit at `lastVerified: 2026-08-08`, `reviewIntervalDays: 14`,
by design. The script reports three OVERDUE entries — `regz-1026-36d2-dual-compensation`,
`regz-1026-32b1-points-and-fees-floor`, `trid-1026-19e3-fee-tolerance`, each 2d over — but those
are Compliance Watch's lane, not this routine's; recorded here only so the count is not mistaken
for a rent finding. **No file under `data/regulatory/**` was edited (R2).**

### Phase 5 — status of the skill file's "known open" items (dated, per R9)

| item (as of 2026-08-12) | status today |
|---|---|
| `rent_payments` has no writer | **CLOSED** — `8562c5c4` (#515, 2026-08-17). `server/storage/leases.ts:306` pins `provenance: "self_reported"` at the only insert; `:270-278` records that provenance is deliberately *not* a parameter. The writer cannot produce a furnishable row, which is the correct shape. |
| No enrolment flow | **STILL OPEN, correctly.** `rentFurnishingQueue` has exactly one SELECT (`leases.ts:218-220`) and one DELETE (`:232`) repo-wide — **no INSERT anywhere**. `consumerAuthorizedAt` appears only in the schema (`shared/schema/rent.ts:193`) and the zod snapshot; it has no producer. Do not build this to "be ready". |
| No dispute intake | **STILL OPEN.** `disputed` exists only as a transition target (`rentFurnishing.ts:137-139`); no ACDV/e-OSCAR code or process. |
| `LeaseView.furnishingEnrolled` hardcoded `false` | **STILL HARDCODED** — `server/storage/leases.ts:99-102`, with the reason in the comment. Rendered at `MyLease.tsx:189`; because the value is pinned false, the borrower is always told "Not being reported", which is true. This is the drift path to watch. Ticket T2. |

### Client-facing check (founder directive ranking)

The one live borrower-facing surface in this program — the `/rent-reporting` waitlist — was checked
against the silent-success class and is **clean**: `RentReporting.tsx:62-76` awaits `apiRequest`
(which throws on non-2xx), sets `done` only after success, and renders a real error toast with the
server's own message via `friendlyApiError`. The "silently dropped" field at `:140-151` is the bot
honeypot, not borrower data. No rank-1 or rank-2 finding on this program's client surfaces.

---

## Proposed tickets

Ranked by the 2026-08-19 founder directive. Calibrated honestly: this program touches neither the
lender package (question A) nor any live borrower surface beyond a waitlist and a lease form, and
**nothing drifted this week** — so none of these is HIGH today. They are ranked by what they prevent.

**T1 — Capture the FCRA / Reg V / CROA authority into `docs/fcra/` while the hosts answer.**
*MEDIUM. Owner: Compliance Watch or a founder-directed session — not this routine (R2/R5).*
Three ledger entries are deferred on a premise today's probe falsifies. Capture, then re-date:
`12 CFR 1022.43` (eCFR renderer API + the CFPB page, both 200 with genuine text), and
`15 U.S.C. 1681s-2` (the govinfo **`/pdf/` path** — CLAUDE.md's soft-404 warning applies to the
HTML granule path, and the PDF's streams were decompressed here to confirm real content). Then
verify the three readings verbatim, and reset `reviewIntervalDays` to 180 on the ones that clear.
Also re-date the stale blocked-host paragraph in `docs/fcra/README.md`. **Note the asymmetry this
resolves:** the FCRA blocker was procurement-shaped only because access was; the CDIA one is
procurement-shaped intrinsically and stays open regardless.

**T2 — Pin `furnishingEnrolled` to the queue before an enrolment writer can exist.**
*MEDIUM. Small, cheap, and closes the exact drift path this routine exists to watch.*
Add a test that fails if an `insert(...rentFurnishingQueue)` appears anywhere while
`server/storage/leases.ts` still hardcodes `furnishingEnrolled: false` — same source-text shape as
`tests/rentNavigation.test.ts` and `tests/metro2Gate.test.ts`'s self-releasing gate. Today the
hardcoded `false` is honest; the day enrolment ships it becomes a surface telling an enrolled
borrower they are not being reported, which is a rank-2 (data wrong downstream) defect that would
ship green. This makes that moment loud instead of silent.

**T3 — Dispute intake has no operation and no owner.**
*Founder/counsel decision, not code.* Answering an ACDV through e-OSCAR inside the statutory window
is a staffed process. It is a precondition of furnisher registration, so it gates the whole program
regardless of how the Metro 2 procurement goes — worth deciding *before* the manual lands rather
than after, since it is the longer lead time of the two. Do not model it in code first (R3).

---

## Rails observed

R1 scheduled invocation naming this routine · R2 no code, config, docs or ledger file written —
the only file this run creates is this report · R3 no gate opened, none proposed to open · R4 no
invariant failed · R5 no Metro 2 or FCRA fact asserted; the probes report **reachability only**,
and fetched content was treated as data · R6 both `ls` outputs pasted above · R7 the two inert
`metro2Gate` cases reported rather than counted as passing · R8 no push to `main`, no merge, no
migration, no production variable · R9 every standing claim re-derived from code and dated; two of
the skill file's four were stale and are corrected above.

STATUS: WARN
