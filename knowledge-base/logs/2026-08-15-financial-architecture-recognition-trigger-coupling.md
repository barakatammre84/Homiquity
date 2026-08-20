# Financial architecture re-audit — the recognition trigger has no borrower-paid branch

**Date:** 2026-08-15 · **Base:** `1f520b1` · **Mode:** audit (no code change) · **Routine:**
[`/financial-audit`](../../.claude/skills/financial-audit/SKILL.md) · **Ledger:**
[financial-audit/LEDGER.md](../financial-audit/LEDGER.md)

**Money-path tests at HEAD: 244 green across 12 files.** They pass through every finding below,
which is the same point the 08-14 pass made: the suite exercises the *correct* call shape, so it
cannot see a caller that omits an argument or an input the writers never produce.

---

## Summary

`origin/main` has not moved since the 2026-08-14 audit — same base, `1f520b1`, and **no
money-bearing file changed** — so the diff-driven pass yielded nothing for the third tick running.
This pass instead asked the question the last two ticks' findings set up but did not close:

> The two open High findings (`F-0813-01`, `F-0814-04`) both propose **splitting funding from
> remittance**. If the owner authorizes that fix, what happens to a file where the lender never
> remits at all?

The answer, confirmed by execution: **every borrower-paid file recognizes $0 revenue,
permanently.** That is the exact cohort the 08-12 two-channel fix was written to rescue and that
`F-0814-02` exists to make visible on the admin dashboard. The defect is latent today only because
`compensationReceivedAt` is auto-stamped at funding — i.e. it is masked by the very defect
`F-0813-01` describes, and unmasked by fixing it.

This is a **fix-ordering hazard, not a bug to fix now**, and it is the reason it is being reported
before the owner rules on `F-0813-01` rather than after.

| id | area | sev | one line |
|---|---|---|---|
| `F-0815-01` | capital flow / unit economics | **High (latent — activates on the `F-0813-01` fix)** | The recognition trigger is the lender's remittance advice, and under a borrower-paid election no such event exists. Splitting funding from remittance suppresses the platform-fee channel forever on that cohort |
| `F-0815-02` | unit economics | Low (latent — input is hard-zero today) | `platformFeeRevenue` has no payee dimension inside Section A. Discount points are the creditor's money and would be counted as platform revenue |
| `F-0815-03` | governance / routine memory | Medium | The 2026-08-13 audit — including `F-0813-01`, a **High** finding — sits on a branch **with no pull request at all**. It is invisible to the owner and to every other session |

---

## `F-0815-01` — the recognition trigger has no borrower-paid branch

### The architecture

[`shared/revenueRecognition.ts:15-19`](../../shared/revenueRecognition.ts) states the trigger as an
owner decision, and it is a good one:

> RECOGNITION TRIGGER: the lender's remittance advice (owner decision, 2026-08-08 "recognize on
> receipt"; the receipt event named 2026-08-12). `lender_submissions.compensationReceivedAt` is
> that event.

The same file, forty lines later, states the other half of its own job — that under a borrower-paid
election **the lender remits nothing** (`revenueRecognition.ts:36-40`, and
`expectedLenderRemittance:104` returns a hard `0` for that model).

Both statements are correct. Together they are a contradiction that nothing in the module resolves:
the trigger for recognizing revenue is an event that, by construction, never occurs on a
borrower-paid file. `recognizeRevenue:154-157` gates on the timestamp alone —

```ts
const remittanceArrived =
  !input.simulated &&
  input.status === "funded" &&
  (input.compensationReceivedAt !== null && input.compensationReceivedAt !== undefined);
```

— with no branch on `compensationModel`, although the input carries it (`:133`) and uses it nowhere.

### Why it does not bite today, and what unmasks it

`server/services/lenderSubmission.ts:365` stamps `compensationReceivedAt: fundedAt` for **every**
funded file, borrower-paid included. So the trigger always fires, and the contradiction is hidden.
That auto-stamp *is* `F-0813-01` / `F-0814-04` — the defect that makes the remittance lag a
fabricated zero and the broker's only receivable stateless.

So the two findings are coupled in the one direction that matters: **fixing `F-0813-01` as proposed
activates `F-0815-01`.**

### Confirmed by execution

Against `shared/revenueRecognition.ts` at `1f520b1`, a $400k file — Section A carrying an $8,000
origination fee (the borrower-paid compensation), $500 application, $1,500 underwriting:

| scenario | `recognized` | `platformFees` | `total` | `unrecognizedPlatformFees` |
|---|---|---|---|---|
| borrower-paid, **today** (trigger auto-stamped at funding) | `true` | 14,000 | **14,000** | 0 |
| borrower-paid, **after the proposed split** (no remittance ever) | `false` | 0 | **0** | 14,000 |
| lender-paid, after the split (remittance lands at a 12-day lag) | `true` | 6,000 | **14,000** | 0 |

The borrower-paid file's revenue goes to zero and stays there — not deferred, *unreachable*. The
`unrecognizedPlatformFees` field reports it honestly as pipeline, which is the module doing exactly
what it was built to do; the problem is that the file can never leave that state.

(The 14,000 figures include a $4,000 discount-point line — see `F-0815-02`. The finding holds
without it: 10,000 → 0.)

### Quantified

Every borrower-paid funded file, 100% of that cohort, indefinitely. On the platform's own stated
economics (~$2,000/file of platform charges, plus the origination fee that *is* the compensation
under this election — $8,000 on a $400k file at 200 bps) that is the whole revenue line for the
cohort. The 08-12 fix moved a borrower-paid $400k file from $0 to $6,000; this would move it back
to $0 by a different route, while `unrecognizedPlatformFees` grows without bound.

### Structural fix (proposed — needs the owner, not this routine)

The trigger is per-channel, not per-file. Recognition should ask *which money*:

- **lender compensation** → recognize on `compensationReceivedAt` (the remittance advice). Unchanged.
- **platform fees** → recognize on the event by which they are actually collected, which is
  **closing/funding**, not the lender's wire. `revenueRecognition.ts:21-27` already says this in
  its own header — it calls the single trigger "a simplification", conservative in timing, and
  predicts that "a future receivable model (F-0809-03) will want to split them". That future is
  the `F-0813-01` fix.

Under a borrower-paid election the lender leg is $0 and `as_expected` by
`expectedLenderRemittance`, so the file is fully recognized at funding with nothing outstanding —
which is the economically correct answer and the one today's auto-stamp reaches by accident.

**Sequencing, which is the actionable part:** `F-0813-01` and `F-0815-01` must land **together**,
or `F-0815-01` first. Landing `F-0813-01` alone is a revenue regression on the borrower-paid book.

---

## `F-0815-02` — Section A has two payees and one revenue bucket

`PLATFORM_REVENUE_FEE_IDS` (`revenueRecognition.ts:62-67`) counts four Section A lines as the
platform's revenue, one of which is `points` — *discount points*.

The module is scrupulous about this distinction one section over. Its own comment at `:55-61`
excludes Sections B and C because they are "third-party pass-throughs — the borrower's money moving
to a vendor, never ours", and warns that including them "would restate vendor spend as income".
Discount points are the same shape: the borrower's money moving to the **creditor** to buy the rate
down. The fee table itself labels the section
`// Section A — paid to the creditor / loan originator` (`shared/compliance/feeTolerance.ts:90`) —
two payees, named in the comment, with no field anywhere on `DisclosedFee` to tell them apart.

**Executed:** a Section A carrying one point on a $400k file returns `platformFeeRevenue = 14,000`
under a borrower-paid election ($10,000 of it the platform's own) and **6,000 under lender-paid,
where only $2,000 is the platform's** — a 3× overstatement of the very ~$2,000/file channel that
three separate audits raised.

**Severity is Low because the input does not occur.** `server/services/loanCosts.ts:644` hard-codes
`const points = 0` on the disclosure path (as do `:155` and `:232`), so no file today carries a
nonzero point. This is a guard that does not exist rather than a number that is wrong — recorded
now because the pricing surface already models point scenarios
(`server/services/loanAnalysis.ts:159` builds a `{ points: 1 }` scenario), so the input is one
product decision away.

**Structural fix:** give the revenue split a payee dimension rather than an id allowlist — the
allowlist is what let a creditor charge sit in a platform-revenue constant. Failing that, drop
`points` from `PLATFORM_REVENUE_FEE_IDS` and reintroduce it only with an explicit
broker-retained-points concept.

---

## `F-0815-03` — the 08-13 audit has no pull request

`claude/fervent-mayer-uqcv21` carries the complete 2026-08-13 financial audit — a 286-line log,
four ledger rows, and the correction that the 08-12 triage silently dropped 3 of its 21 findings.
Queried directly: **no pull request exists for that branch, open, closed or merged.**

This is the failure mode this ledger already documents and named as the reason Phase 0.4 reads
branches and not only `main` — four audits once sat stranded without PRs, "invisible to
`gh pr list`, one of them for six days". It has recurred, and this time it is hiding a **High**
finding (`F-0813-01`) plus the completeness rule (`F-0813-02`) meant to stop findings being dropped.

The queue as it actually stands:

| audit | branch | visible to the owner? |
|---|---|---|
| 2026-08-13 | `claude/fervent-mayer-uqcv21` | **No — no PR** |
| 2026-08-14 | `claude/fervent-mayer-sqqrjj` | [#520](https://github.com/barakatammre84/Homiquity/pull/520), open, unreviewed |
| 2026-08-15 | `claude/fervent-mayer-w2dx4y` (this one) | pushed; no PR opened |

Three consecutive audits, none merged, all four-plus High/Medium findings unreviewed. The routine
is producing findings faster than they are being read, which is the condition R4's backpressure
rail exists to detect — and it did: with one *PR* open the rail reads 1, because a stranded branch
is not a PR. **The rail counts the wrong thing.** A branch with no PR is not backpressure relief;
it is the worst case, work done and invisible.

**Structural fix:** count *unmerged audit branches*, not open PRs, in the R4 check — and have a
tick that finds a stranded sibling branch surface it to the owner by notification, which is what
this tick did.

---

## Verified sound this pass

- **`F-16` asset-light structure** — re-verified: no money movement anywhere in the codebase; the
  platform never takes custody of borrower or lender funds. The operational-account-separation and
  duration-mismatch questions remain *not applicable by construction*, and stay that way until
  `F-14` (broker vs. mini-correspondent) is decided by the owner.
- **`expectedLenderRemittance`** — correct on both elections (`borrower_paid → 0`,
  `lender_paid → expected`). The defect in `F-0814-01` is entirely in the *callers* that omit
  `compensationModel`, not in the rule.
- **The funding gate accepts a zero remittance** — `z.number().min(0)`
  (`server/routes/underwriting/submissions.ts:294`), so a borrower-paid file can be marked funded
  with $0 received. Checked because a `.positive()` there would have blocked the entire
  borrower-paid cohort at the revenue moment. It does not.

## Independently re-confirmed at HEAD (do not re-discover)

The 08-14 findings were verified by direct read and execution this pass, since they are unmerged
and unreviewed:

- `F-0814-01` — `evaluateCompensationVariance` omits `compensationModel` at
  `server/services/lenderSubmission.ts:357` and `server/routes/underwriting/submissions.ts:378`;
  only `shared/compensationLedger.ts:284` passes it. Executed: same $400k borrower-paid file →
  `as_expected` on the roll-up path, `short_paid` on the worklist path. **Confirmed.**
- `F-0814-02` — `recognizeRevenue` has exactly one call site
  (`server/routes/underwriting/submissions.ts:425`); `server/storage/stats.ts` does not call it.
  **Confirmed.**
- `F-0813-01` / `F-0814-04` — `compensationReceivedAt: fundedAt` at
  `server/services/lenderSubmission.ts:365`, the sole writer. **Confirmed.**

---

## Method note

Third consecutive tick with an empty money-path diff. The three findings came from the two standing
signals that do not need a diff: **"who else reads the rule"** (`F-0815-02` — an id allowlist read
by one channel with no payee concept behind it) and a new one this pass suggests adding —

> **Standing signal #6: audit the *interaction* between open findings, not only each one.**
> `F-0815-01` is invisible from either `F-0813-01` or `F-0814-02` alone. It exists only in the
> composition: one finding's fix removes the accident that is masking another finding's defect. A
> register of open findings is also a register of pending changes, and pending changes interact.
