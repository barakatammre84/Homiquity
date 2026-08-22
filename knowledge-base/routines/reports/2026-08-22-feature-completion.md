# Feature Completion Engine — 2026-08-22

**Domain:** 6 — Pricing, rates & disclosures · area **18, Offer comparison and anti-steering**
(`FEATURE_MAP.md`), taken under the standing **above-conforming borrower** segment.
**Gap:** the offers surface rendered *nothing at all* for the three statuses that mean "no live
pricing, and here is why".
**PR:** [#657](https://github.com/barakatammre84/Homiquity/pull/657) (ready — no §9 trigger).
**Open findings in `FINDINGS.md`:** 135 before · **135 after** — this run closed none; see §5.

STATUS: OK — one completion gap shipped, mutation-proven, full gate green.

---

## ⛔ Human actions

**None blocking.** One decision worth the founder's eye, hardest first:

1. **F-0818-06 is now visible rather than invisible, and still unfixed.** The anti-steering consent
   card (`LoanOptions.tsx:193`) is gated only on `!steeringAcknowledged` — never on whether any
   options exist — so a borrower can sign *"these loan options were presented to you"* on a page
   showing none, which permanently unlocks rate lock (`pricing.ts:624-637`) and clears the stage-3
   submission blocker. That row is Reg Z-flagged (§1026.36(e)(2), *flagged, not ruled*) and changing
   when a borrower may acknowledge is a behavioural change to a consent gate, so it was deliberately
   **not** folded into this diff. It wants its own reviewed PR. This run's change removes the part
   that made it hardest to notice: the borrower now at least reads why there are no options.

---

## Summary

`GET /api/loan-applications/:id/offers` answers with four statuses, and for three of them the server
deliberately builds borrower-facing `missingItems` copy. `MarketPricingSection` opened with
`if (market.status !== "PRICED") return null` and is the endpoint's **only** client reader, so
`missingItems` had zero readers anywhere in the app and the entire "Live Market Pricing" block
vanished with no explanation. The above-conforming borrower is the one this hurts: their whole
market is a single product (`BRC-J30`) with `minCreditScore: 700` and `maxLTV: 89.99`, so a jumbo
file just outside that box prices to zero offers and lands on `NO_ACTIVE_RATE_SHEETS` far more
readily than any conforming file ever does. The three states now render an explained zero-state
through the shared `patterns/EmptyState`, list the server's own reasons, and carry a standing
qualifier. No server change, no schema, no regulated math, no new dependency.

---

## Evidence

**The capability the client could not reach.** The server builds three distinct states:

```
server/routes/lending/pricing.ts:482   status: "INSUFFICIENT_PROFILE",  missingItems   (Purchase price / Down payment / Credit score)
server/routes/lending/pricing.ts:510   status: "UNPRICEABLE_PROFILE",   missingItems: ["Live pricing is not available for this loan profile yet — your loan team will quote it directly."]
server/routes/lending/pricing.ts:529   status: offers.length > 0 ? "PRICED" : "NO_ACTIVE_RATE_SHEETS"
```

The client threw all three away:

```
client/src/pages/lending/loanOptions/MarketPricingSection.tsx:42  if (market.status !== "PRICED") return null;
```

`missingItems` on this endpoint had **zero** readers — the only other `missingItems` hits in
`client/src` belong to the unrelated scenario simulator:

```
$ grep -rn "missingItems" client/src
client/src/components/ScenarioSimulatorDialog.tsx:339        <- useScenarioSimulator, different endpoint
client/src/hooks/useScenarioSimulator.ts:75                  <- ditto
client/src/pages/lending/loanOptions/MarketPricingSection.tsx:18   <- type only, never rendered
```

**Why the above-conforming borrower lands there.** Above the limit, every conforming/FHA/VA/ARM
product is filtered out by `maxLoanAmount: CONFORMING_LIMIT`, leaving exactly one product in the
whole market:

```
server/seedMarketPricing.ts:204
  productCode: "BRC-J30", productType: "JUMBO",
  eligibilityConstraints: { minLoanAmount: CONFORMING_LIMIT + 0.01, maxLoanAmount: 3000000,
                            minCreditScore: 700, maxLTV: 89.99, ... }
```

`computeOffers` drops any product failing `checkEligibility` (`pricingAdapter.ts:158`), and an empty
result is `NO_ACTIVE_RATE_SHEETS`. A move-up buyer at an $850k loan with a 690 score, or 8% down,
therefore saw the section disappear entirely.

**Dated, not assumed.** `git log -S` puts the `return null` at `83707797` (original build) and
`b3a006da` (#402, the page split) — it has been shipped behaviour throughout, not a recent
regression. The move-up lane's other known defect — `AdvisoryPanel.tsx` gating jumbo on a hardcoded
`766550` — is **already fixed** on `main` (`AdvisoryPanel.tsx:78` reads `CONFORMING_LOAN_LIMIT_2026`,
pinned by `tests/adversarialPersonas.test.ts:587-602`), so it was not re-reported.

**Proven by reintroducing the bug.**

```
# 1. test first, against unchanged code
$ npx vitest run --config vitest.client.config.ts .../MarketPricingSection.test.tsx
  Tests  3 failed | 1 passed (4)
  TestingLibraryElementError: Unable to find an element by: [data-testid="section-market-pricing-unavailable"]
  Ignored nodes: comments, script, style
  <body> <div /> </body>            <- the component rendered literally nothing

# 2. fix
  Tests  4 passed (4)

# 3. revert the one line to `return null`
  Tests  3 failed | 1 passed (4)

# 4. restore
  Tests  4 passed (4)
```

**The new file is genuinely collected by the client lane** (it is glob-picked, but asserted rather
than assumed):

```
$ npx vitest run --config vitest.client.config.ts --reporter=verbose | grep MarketPricingSection
 ✓ client/src/pages/lending/loanOptions/MarketPricingSection.test.tsx > ... explains a profile no active rate sheet covers, instead of rendering nothing 45ms
 ✓ ... surfaces the server's own reason for an unpriceable profile 3ms
 ✓ ... lists every missing item when the profile is too thin to price 2ms
 ✓ ... still renders priced offers, and no unavailable block, when pricing succeeded 51ms
```

**Full gate.**

```
pnpm check                 clean (0 errors)
pnpm test — node lane      Test Files 215 passed (215) · Tests 3112 passed | 1 skipped (3113)
pnpm test — client lane    Test Files 119 passed (119) · Tests  795 passed (795)
guard:tokens               0 raw palette occurrences · 97 bare white/black — at baseline ✅
guard:querykeys            reachability OK · transport OK ✅
guard:schema               OK — every schema column migrated or baselined ✅
guard:migrations           OK — 57 migrations, contiguous idx 0..56 ✅
guard:kb                   OK — 196 docs indexed, no dead links ✅
guard:docs                 OK — 8 living docs within interval ✅
pnpm build → guard:bundle  523,909 raw (at the raised baseline) ✅
security-review-guard      detectTriggers(diff) → []  ⇒ ready PR, not draft
```

**The 8 bundle bytes, measured rather than waved through.** The eager entry grew 8 raw bytes
(523,901 → 523,909). It was isolated, not guessed:

| tree | eager raw |
|---|---|
| clean `origin/main` | 523,901 (at baseline ✅) |
| fix, importing `patterns/EmptyState` | 523,909 (+8) |
| same fix, importing the base `ui/empty-state` | 523,905 (+4) |
| same fix, markup hand-rolled, no shared import | 523,901 (+0) |

So the cost is not code weight — it is the lazy `LoanOptions` chunk gaining a dependency edge on an
existing shared chunk, which Vite records in the eager entry's preload map. Dropping a new lucide
glyph changed nothing (still +8), which is what ruled the icon out. **The zero-byte option was
rejected deliberately:** hand-rolling the zero-state re-introduces exactly the duplication
`components/patterns/**` exists to remove, and the pattern's `scope`-derived heading is a structural
honesty control (§13), not decoration. 8 bytes on 523,901 is 0.0015%, and the baseline is raised in
the same PR with this paragraph as the reason.

⚠️ **Not verified in a browser.** No dev server was started and `scripts/browser-probe.cjs` was not
run, so there is no rendering evidence at 320/768/1280 — the claim here is component-level only.

---

## What this run did **not** do

- **Closed no `FINDINGS.md` row.** 135 open before, 135 after. The change touches two rows without
  closing either, and both are recorded as such rather than claimed:
  - **F-0818-06** — the anti-steering consent card ungated on option availability. Its own text
    already cites `MarketPricingSection.tsx:42` as the reason its three non-transient states are
    invisible; those states are now visible, but the consent gate itself is untouched.
  - **ux-33** — *"market pricing unavailable ⇒ zero qualifying language"* is one leg of its net
    scenario, and that leg now carries *"estimates … not offers, and not an approval"*. The finding's
    substance — the default **card** view stating rate/APR/payment unqualified — is unchanged.
- **No server change.** Adding a reason string for `NO_ACTIVE_RATE_SHEETS` is an API payload change,
  outside a UI-lane diff per DESIGN_SYSTEM §14 / `app-guide/12-api-contract.md`. Ticket below.
- **Invented no service tier and promised no lender.** The move-up lane rail M6 binds: the copy says
  what today's sheets do and stops. It never implies we can place a jumbo loan we have no lender for,
  and never implies approval or denial.
- **Did not invoke the `hq-offers-owner` agent** that `FEATURE_MAP.md` names for area 18, despite the
  map being on `origin/main`. This session runs under a harness rule forbidding subagent dispatch
  unless the operator asks for it; the map was read directly instead, so the area's file list and
  authority chain still informed the work. Recorded because the routine's own instructions call for
  the hand-off.

---

## Proposed tickets (for Evening Triage to land)

1. **F-0818-06 — gate the anti-steering card on there being options to steer between.** Render
   `ConsentGateCard` at `LoanOptions.tsx:193` only when `options.length > 0 || market.status ===
   "PRICED"`. Tightens a consent gate, which is the one permitted direction; Reg Z-flagged, so it
   wants a cited review in its own PR.
2. **Give `NO_ACTIVE_RATE_SHEETS` a server-side reason string**, the way `UNPRICEABLE_PROFILE`
   already has one, so the two sibling states are explained from one place instead of one on each
   side of the wire. Backend Data Engineer lane (payload shape).
3. **A superlative over a set of one.** `pricingAdapter.ts:239` unconditionally badges the first
   offer `LOWEST_RATE`. Above the conforming limit there is exactly one product, so the jumbo
   borrower is the only borrower who is ever shown "Lowest rate" on a market of one. Suppress the
   labels when `offers.length === 1`. Server lane; DESIGN_SYSTEM §13 honesty.
4. **ux-33's card-view leg** — the default `cards` view still shows rate, APR and payment with no
   qualifier while only the `compare` view carries one. Unchanged by this PR and still open.

---

STATUS: OK
