# The 15-day lender-demo sprint

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** `origin/main` @ `c8bb44f`. **Authoritative:** the ranking lives in
> [LENDER_DEMO_TEN.md](LENDER_DEMO_TEN.md); this file only sequences it. The
> [definition of done](../governance/TEAM_PRACTICES.md) §5 binds every day below.

## What this is

A day-by-day route from today to **one real client file, driven through the real UI in front of a
wholesale lender's Account Executive, producing a package that is clean and true.**

**The rule that makes it work: every day ends with a command whose output you can paste.** Not "I
think it works" — a stamped output. That convention is borrowed from
[`knowledge-base/handoff/`](../handoff/README.md), where *"a count without its command does not
appear in this corpus."* It exists because this repo's dominant defect is the **silent success**: an
operation that did not happen while the tooling said it did.

## Two lanes, run in parallel

| Lane | Owner | Appears in `CTO_ROADMAP.md`? |
|---|---|---|
| **Build** — the Ten, below | Engineering | Yes — it is now the only thing that does |
| **CEO** — converting relationships into signed broker agreements; starting the QC manual that Selling Guide A3-3-01 requires | Founder | No — moved to [CEO_BUSINESS_QUEUE.md](../governance/CEO_BUSINESS_QUEUE.md) per founder direction 2026-08-23 |

The lanes are independent by design. The build lane does not wait on paperwork, and the paperwork
does not wait on the build — but the **demo is what converts the relationship**, so the build lane
sets the meeting date.

## Cadence

One item per day, one PR per day. From `TEAM_PRACTICES.md` §4: *"If a PR cannot survive one CI
cycle without going stale, it is too big"* and *"roughly one push a day is the expected rhythm."*
Merge `main` before opening each PR — the branch that produced this document was **53 commits
behind**, and every claim in it had to be re-verified at the new HEAD before it could be trusted.

⚠️ **CI is currently ungated** (`CTO_ROADMAP.md` KTLO-4: `required_status_checks.contexts: []`, and
Railway's `checkSuites: false`). Until that is restored, `pnpm preflight` on the laptop **is** the
gate. Run it before every push.

---

## Day 0 — ground truth

Nothing gets built off a register with 21 mislabeled rows in it.

- `bash scripts/dev-up.sh` — one command from a clean checkout to a running app on :5001.
- Reconcile `FINDINGS.md` + `CTO_ROADMAP.md` §3 against the code. Move every row whose status cell
  says FIXED into `## Closed`. Four are proven stale in
  [LENDER_DEMO_TEN.md §5a](LENDER_DEMO_TEN.md); an audit found 21 plus 4 more in an undocumented
  "fix landed, awaiting re-verification" state.

**Exit test**
```bash
bash scripts/dev-up.sh status          # → up, on <sha>
curl -s localhost:5001/api/health      # → 200; commit: null IS the local-dev signature
bash scripts/preflight.sh --fast       # → all green
```

---

## Days 1–2 — stop the disqualifiers

**Day 1 · Item 1 · the P0.** Whole `users` rows — `passwordHash` included — are returned to
brokers and to third-party partner companies. This runs first because it is the one finding that
ends a lender relationship rather than delaying it, and because it is live right now.

```bash
# before: the leak
grep -n "borrower: r.users\|broker: c.users" server/storage/brokerReferrals.ts
# after: no response body may contain it
grep -rn "passwordHash" server/storage/*.ts     # → explicit omission, not absence
pnpm test tests/responseShape.test.ts           # → new test, red on main, green here
```

**Day 2 · Item 2 · the consent attestation.** The borrower signs that options came from *"the
wholesale lenders with whom we regularly do business"* while the code computes
`creditorsQuoted === 0`.

**Exit test:** render the consent on a file with zero quoting counterparties; no unearned
relationship claim appears.

---

## Days 3–8 — the package must not lie

**Days 3–4 · Item 3 · co-borrower blindness, both layers.**

```bash
# (a) delivery: one PARTY per borrower
grep -c "<PARTY>" /tmp/package.xml     # → 2 on a two-borrower file (was 1)
# each employment under its own party, keyed by borrowerSequenceNumber

# (b) underwriting: representative credit score
# a 760 primary + 600 co-borrower must price and gate on 600, per B3-5.1-02
```

**Day 5 · Item 4 · stop emitting guesses as facts.**
**Exit test:** a file with occupancy, purpose, lien priority and marital status absent emits *no
element* for each — not `PrimaryResidence`, `Purchase`, `FirstLien`, `Unmarried`.

**Days 6–7 · Item 5 · the "emitted == stored" truth gate.** The keystone. It is what makes days 3–5
stay fixed, and it is the leg `WORKFLOWS.md:32` already says Workflow 3 must gain before it is
re-run.

**Exit test:** red on `main`, green on the branch — then mutate one stored field by hand and watch
the test fail. *A gate that has never failed has never been tested.*

**Day 8 · Item 6 · make conformance a real gate.**
```bash
# a deliberately broken XML must be REFUSED at submit, not recorded as a warning
# and with xmllint absent, startup must FAIL rather than silently skip
```
**Also today, and it costs nothing:** put **U-25** on the AE agenda — the generator is
`generateMISMO34XML`, the only schema in the repo is MISMO **3.0**, and the AE can settle in ninety
seconds what we cannot settle at all.

---

## Days 9–11 — an organic client must reach it

**Days 9–10 · Item 7 · prior-employment capture.** Any borrower under two years' tenure is
hard-blocked today, and the block reads as a validation error rather than an instruction.

**Exit test:** a borrower with 14 months at their current job completes URLA and clears stage 2.

**Day 11 · Item 8 · the e-consent orphan.** Consents written with `applicationId = null` are
invisible to every application-scoped gate.

**Exit test:** a consent signed on `/e-consent` unlocks the Loan Estimate on that application.

---

## Days 12–13 — survive being watched

**Item 9.** Three failures the AE will personally witness:

- the staff Intelligence tab throws and **unmounts the entire routed app** — it has never worked in
  any commit;
- **1,663 of 1,723 task rows have `sla_due_at IS NULL` and every one renders "green / on time"**;
- the silent-success writes: the co-brand `PUT` that returns 200 and writes nothing, the invite
  `resend` that sends no email, the `/compare-offers/:id` Confirm.

**Exit test:** click every screen on the demo route; every write round-trips after a reload.

---

## Day 14 — the organic dress rehearsal

Not a seed. `routines/CHARTER.md` §1: *"Green delivery suites hide the seed-vs-organic gap because
the fixture is the seed."*

Drive a real two-borrower purchase file through the actual UI, start to finish, timed, as if the AE
is watching — because on the next working day they are. Produce the hand-off bundle: validated XML +
income-analysis JSON + both sha256 hashes + the readiness snapshot.

**Exit test:** the bundle downloads, the hashes verify, the XML opens in a viewer, and every figure
in it matches the file you just built by hand.

Anything that stumbles here is a Day-15 fix — **not a live surprise.**

---

## What this sprint deliberately does not do

| Deferred | Why |
|---|---|
| **ARM (`F-053`)** | Seven fields captured nowhere, zero `INTEREST_RATE_ADJUSTMENT` containers. Scope the demo to fixed-rate and say so on screen; raise it with the AE as roadmap, not as a gap they find. |
| **The second ten** (QC manual, `F-0819-01`, `F-0819-02`, the §1002.9 clock, consent expiry, G-21 CLTV) | Needed for *approval*, not for the *meeting*. See [LENDER_DEMO_TEN.md §7](LENDER_DEMO_TEN.md). |
| **Anything gated on a vendor contract** | F3 credit, F6 DU/LPA, F4 Plaid, F7 AVM, F11 PPE. The app is what wins these; building against them now is building against nothing. |
| **Peripheral surfaces** | Homeowner Hub, realtor engine. `L1` §4 calls these peripheral and never loop-blocking. |

## The one question that could change all of this

**Does the lender's onboarding run its security/QC review before the technical demo, or after?**
If before, the second ten moves on-path and this becomes a seven-week plan. Ask it in the first call.
