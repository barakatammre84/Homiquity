# Feature Completion Engine — 2026-08-22 (second tick)

**Domain:** 11 — Staff, partner & pipeline ops · **area 17, Pre-approval and pre-qualification
letters** (`FEATURE_MAP.md` row 17, **Last reviewed: never** — one of the 23 of 41 unmeasured
areas). The area is filed under a staff domain; its defect is entirely borrower-facing, which is
part of why nobody had looked.
**Gap:** every borrower-facing letter surface read `hasLetter` alone, so a letter that had **expired**
or been **revoked** still rendered "ready to download" — and there was no path to a fresh one.
**PR:** [#689](https://github.com/barakatammre84/Homiquity/pull/689) · **Open `FINDINGS.md` rows:** 219 before · 219 after (unique ids in the *Open
findings* section; this run closed none and minted none — see *Honesty*).

STATUS: OK

---

## ⛔ Human actions

1. **`POST /api/loan-applications/:id/generate-letter` does not check whether the previous letter
   was revoked.** It mints a new `pre_approval_letters` row unconditionally
   (`server/routes/lending/letters.ts:48-351` — the status, licensed-state and provenance gates are
   all there; a revocation check is not). Today the borrower cannot reach it after a revocation
   (this PR keeps it that way, deliberately), but **staff can**: `loCommandCenter/ActionsRail.tsx:35`
   posts to it with no status precondition, so a one-click "Generate Letter" silently un-does a
   credit decision another staff member made under `CREDIT_DECISION_ROLES` with a mandatory written
   reason. **Server-side fix, `hq-letters-owner`'s lane, not shipped here** — it is a different gap
   from the one this PR takes, and folding it in would have made a one-gap diff into two.
2. **The pre-approved dashboard card shows *pre-qualification* letter status.**
   `components/dashboard/PreApprovedCard.tsx` renders under `status === "pre_approved"` but queries
   `prequal-status` / `generate-prequal`, while `LoanOptions` at the same status queries
   `letter-status`. That is **deliberate and documented** in the card ("Normalizing pre-approval vs
   pre-qualification is the deferred, compliance-gated COPY track"), so it is left exactly as it
   was — but it means a pre-approved borrower can be looking at two different letters' states on
   two screens. Naming that as a decision rather than leaving it as a surprise.

---

## Summary

Area 17 has never been reviewed, and the gap is the classic one for this codebase: the backend is
more careful than the surface that renders it. `shared/letters.ts effectiveLetterStatus` computes
expiry **at read time** precisely so the API can never report `issued` on a lapsed letter whatever
the nightly sweep's timing, and both status endpoints return that `status` plus `expirationDate`;
the staff card renders the full vocabulary (Issued / Expired / Revoked / Superseded) from it. All
three borrower surfaces threw it away and read `hasLetter`. The fix is one shared selector,
`client/src/lib/letterStatus.ts`, consumed by all three — the `lib/outstandingWork.ts` shape the
register recommends — plus the reissue path that the server's own comment says the UI should offer
and never did. Nothing server-side, no schema, no regulated math, no new dependency.

---

## Evidence

### The gap, dated

`effectiveLetterStatus` and the whole revoke/expire lifecycle landed **2026-08-04** in
`a83b3fd2` (*"feat(letters): complete the pre-approval letter status lifecycle — revocation +
expiry"* / #340); the staff card that renders it landed the same day in `0746f8e8` (#343). The
client's `hasLetter` read predates both (`f89838cb`, initial commit; last moved by `b3a006da`/#402,
a mechanical page split). So this is **shipped behaviour for the whole life of the lifecycle
feature, not a recent regression** — the read side was never wired when the write side landed.

```
$ git log --oneline -S 'effectiveLetterStatus' -- shared/letters.ts server/routes/lending/letters.ts client/src
0746f8e8 feat(staff): pre-approval letter card with role-gated revocation in the borrower file (#343)
a83b3fd2 feat(letters): complete the pre-approval letter status lifecycle — revocation + expiry (#340)
        # both 2026-08-04; neither touches a borrower surface
```

### What the server offers, and what the client read

```
server/routes/lending/letters.ts:459-466   letter-status  → { hasLetter, letterNumber, status: effectiveLetterStatus(letter),
                                                              expirationDate, generatedAt, revokedAt, pdfAvailable }
server/routes/lending/letters.ts:812-818   prequal-status → { hasLetter, letterNumber, status: effectiveLetterStatus(letter),
                                                              expirationDate, estimatedAmount, generatedAt, pdfAvailable }
```

…and the server says in so many words what it expected the UI to do with it:

```
server/routes/lending/letters.ts:379-382
  // A revoked letter must not keep circulating silently … Expired letters still download:
  // the document shows its expiration date on its face, and letter-status reads "expired"
  // so the UI can prompt a reissue.
```

**That reissue prompt did not exist anywhere.** Before this PR, the three readers:

| surface | what it read | what a borrower saw on an expired letter |
|---|---|---|
| `pages/borrower/borrowerDashboard/PreQualLetterCard.tsx:42` | `statusQuery.data?.hasLetter` | "Your letter is ready to download" + **Download** |
| `components/dashboard/PreApprovedCard.tsx:69` | `statusQuery.data?.hasLetter` | "Download pre-qualification letter" |
| `pages/lending/loanOptions/LoanLetterButton.tsx:111` | `statusQuery.data?.hasLetter` | "Download Pre-Approval Letter" |

Both `useQuery` generics literally omitted `status` (`useQuery<{ hasLetter: boolean; letterNumber?:
string }>`), so the field was invisible to the type system too. Meanwhile
`pages/staff/borrowerFile/PreApprovalLetterCard.tsx:110,125` renders `LETTER_STATUS_BADGE[status]`
— **Issued / Expired / Revoked / Superseded** — from the same endpoint. Two surfaces, one fact,
opposite answers: `DESIGN_SYSTEM.md` §13 **Agreement** ("no two elements may disagree about the
same fact… all counts, badges and progress indicators derive from **one** selector").

Two concrete consequences, both client-visible:

- **Expired.** `hasLetter` stays true forever, so the Generate button never returns. The borrower
  is permanently offered a download of a lapsed creditworthiness document and has **no self-serve
  route to a current one** — while `generate-prequal` and `generate-letter` both insert a *new* row
  and every read path takes `ORDER BY createdAt DESC LIMIT 1`, i.e. reissue works and was simply
  unreachable.
- **Revoked.** `letter-pdf` returns **409 `letter_revoked`** (`letters.ts:383-390`). The client's
  `handleDownload` catches every rejection into one string — *"Failed to download letter."* — so a
  staff credit decision reached the borrower as an unexplained glitch, under a button still
  labelled "Download Pre-Approval Letter".

### The change

Client-only, 8 files (4 new). `client/src/lib/letterStatus.ts` maps a status payload to one of five
states and answers three questions: may this be downloaded, may the borrower ask for a fresh one,
and what one sentence explains a letter that is neither.

- `expired` → no download; **"Get an updated letter"**, which is the path that already worked.
- `revoked` → **neither** download nor reissue. A borrower re-minting a letter their loan team
  revoked would defeat the revocation, so this direction is deliberately closed. The staff
  revocation *reason* stays server-side, as the route intends; the copy says only that the loan
  team withdrew it — pinned by a test asserting the word "reason" never appears.
- `superseded` / `draft` / **any unrecognised status** → same closed treatment (fail closed: a
  vocabulary this client does not know may never render as "ready").
- **query error** → `kind: "unknown"`; the surface claims nothing rather than falling through to
  "Generate", which is what `data === undefined` used to do.

### Proof — the bug, reintroduced

Written test-first against unchanged code, then mutated after the fix:

```
1. test first, unchanged components          Tests  3 failed | 3 passed (6)
   AssertionError: expected <button …/> to be null
   + Received: <button data-testid="button-download-letter" …>     <- on an EXPIRED letter
   + Received: <button data-testid="button-download-letter" …>     <- on a REVOKED letter
   + Received: <button data-testid="button-download-prequal" …>    <- expired pre-qual

2. fix                                       Tests  19 passed (19)   (3 files)

3. mutate: canDownloadLetter → `kind !== "none"`, canRequestLetter → `kind === "none"`
   i.e. exactly the old hasLetter-alone rule
                                             Tests  9 failed | 10 passed (19)
   × letterStatus: never offers a download of an expired letter …
   × letterStatus: never lets a borrower re-mint a letter their loan team revoked
   × letterStatus: covers every member of the shared letter vocabulary
   × letterStatus: fails closed on a status it does not recognise
   × LoanLetterButton: says a pre-approval letter expired and offers a fresh one …
   × LoanLetterButton: neither downloads nor re-mints a revoked pre-approval letter
   × LoanLetterButton: applies the same rule to the pre-qualification letter
   × PreQualLetterCard: does not call an expired letter ready, and offers an updated one
   × PreQualLetterCard: offers no action at all on a letter the loan team withdrew

4. restore                                   Tests  19 passed (19)
```

The three new files are asserted to be **collected**, not assumed — client tests are glob-picked,
and `vitest run <file>` defaults to the node config, which would have run nothing:

```
$ npx vitest run --config vitest.client.config.ts <the three files> --reporter=verbose
 ✓ client/src/lib/letterStatus.test.ts                                   (9)
 ✓ client/src/pages/lending/loanOptions/LoanLetterButton.test.tsx        (6)
 ✓ client/src/pages/borrower/borrowerDashboard/PreQualLetterCard.test.tsx (4)
```

### Gate

Filled in against the merged tree in the PR body. `detectTriggers()` over the real diff:

```
$ node -e '… detectTriggers(files, parseChangedLines(diff)) …'
FILES: 8 LINES: 523
TRIGGERS: []          ⇒ no §9 security review required; PR opens ready, not draft
```

Guards, run in the worktree:

```
guard:tokens      0 raw palette occurrences · 97 white/black literals — both at baseline ✅
guard:querykeys   reachability OK · transport OK ✅
guard:schema      OK — every schema column migrated or baselined ✅
guard:migrations  OK — 57 migrations, contiguous 0..56 ✅
guard:kb          OK — 196 docs indexed, no dead links ✅
guard:docs        OK — 8 living docs within interval ✅
```

---

## Proposed tickets

1. **Revocation check on `generate-letter`** (⛔ 1 above) — server-side, `hq-letters-owner`.
   A revoked letter should block reissue until a `CREDIT_DECISION_ROLES` holder clears it, or the
   route should require an explicit override with its own audit entry. Today `ActionsRail`'s
   one-click generate silently supersedes a revocation.
2. **`prequal-status` has no `revokedAt` and `preQualificationLetters` has no revocation route.**
   The shared selector handles `status: "revoked"` on both letter kinds because the column and the
   vocabulary allow it, but nothing can currently write it on a pre-qual letter. Either the
   revocation route should cover both tables or the pre-qual row's status should be narrowed —
   right now the schema promises a transition no code performs.
3. **The letter-expiry sweep's real cadence is unverified.** `runLetterExpirySweep` is wired to
   `GET /api/jobs/letter-expiry` and scheduled at `30 12 * * *` in `cron-jobs.yml:31`. Whether that
   workflow has actually been firing is **UNVERIFIED here** — this run did not probe Actions. It
   does not affect this fix (the API computes expiry at read time and the client now reads it), but
   a sweep that has silently stopped leaves every direct reader of `pre_approval_letters` —
   staff queries, reports — believing lapsed letters are issued.

---

## Honesty — what this run did not do

- **No `FINDINGS.md` row was closed or minted.** 219 open before, 219 after (unique ids in the
  *Open findings* section). This defect was **not in the register** — I found it by walking area 17,
  fixed it in the same PR, and did not mint an id for something that was never open. The nearest
  existing row, **F-061**, is a different axis (the *generate* button offering an action the
  provenance gate 422s, with the server's honest message discarded); its `LoanLetterButton.tsx:51`
  evidence line still stands and this PR does not close it.
- **No browser verification.** No dev server was started in this unattended run and
  `scripts/browser-probe.cjs` was not run, so **nothing here is a claim about rendered layout,
  contrast, or mobile**. The evidence is executed component tests under happy-dom, which has no
  layout engine.
- **`PreApprovedCard.tsx` has no test of its own.** It consumes the same selector and its three
  branches are exercised by the selector's tests, but the component itself is unpinned — stated
  rather than implied by the "3 files passed" line above.
- **The claim was pushed before the code was written** (`e814e951`), per §5.5, and is released in
  this PR.
- **Peers:** `client/src/lib/letterStatus.ts` is now shared ground. Derive what a surface may say
  about a letter from it rather than re-reading `hasLetter` — that re-derivation is exactly what
  let three borrower surfaces disagree with the staff card for eighteen days.

STATUS: OK
