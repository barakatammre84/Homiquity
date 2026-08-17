# State launch ladder — licensing & compliance posture per state

**Maintained by:** the `compliance-watch` routine (Tuesdays). **Owner of every decision:** the
founder — every filing/signature is L3 per CHARTER §1b. **Seeded:** 2026-08-17, by the authoring
session, deliberately sparse: **every row below is `unverified` until the routine's first run
verifies it against `docs/nmls/` (chapter/page) or a named state source.** A row asserted without
a cite is invalid (routine rail R3).

Launch sequence (CHARTER §1a): **Illinois → California → national on business performance.**

Status vocabulary: `done` · `drafted` · `in-progress` · `blocked-founder` · `unverified`.

## Company-wide (state-independent)

| id | item | status | evidence / cite | baseline |
|---|---|---|---|---|
| CW-0.1 | Confirm what NMLS #427468 currently covers (an NMLS ID is a system record, not a state license — Guidebook Ch. I §D, PDF p.13) — verify on NMLS Consumer Access; record scope here | blocked-founder | **Partial scope IS in-repo** (corrected 2026-08-17 — the seeded "not recorded anywhere" claim was born stale): `shared/companyIdentity.ts:120-139` — `LICENSED_STATES=["IL"]` + **Illinois Residential Mortgage License #3423789**, founder-confirmed 2026-07-17 (#201) and 2026-08-06; the file itself says rendering the number does not prove it (`:135-136`). Remaining: Consumer Access verification — founder access needed | 2026-08-17 |
| CW-0.2 | Company Form (MU1) posture: control persons, qualifying individuals, disclosure questions, ACN obligations — enumerate what is on file vs. required | unverified | Guidebook Ch. II (PDF pp.18–51) — enumerate on first run | 2026-08-17 |
| CW-0.3 | MLO licensure & sponsorship posture (MU4): who originates, sponsored by whom, in which states | unverified | Guidebook Ch. V (PDF pp.89–111) | 2026-08-17 |
| CW-0.4 | Mortgage Call Report obligations: which components, first due date | unverified | Guidebook Ch. VIII (PDF pp.126–135). ⚠️ Guidebook-internal wording variance found 2026-08-17: Standard-filer FC deadline reads "calendar year end" (p.126) vs "fiscal year end" (p.128) — escalate per R4, never harmonize | 2026-08-17 |
| CW-0.5 | Surety bond posture (ESB): whether required per licensed state, amount basis, renewal | unverified | Guidebook Ch. IX (PDF pp.136–142); amounts are state-specific — needs state checklist | 2026-08-17 |
| CW-0.6 | Financial statement / net-worth filing obligations | unverified | Guidebook Ch. VII (PDF pp.120–125) | 2026-08-17 |

## Illinois (launch state 1)

| id | item | status | evidence / cite | baseline |
|---|---|---|---|---|
| CW-IL.1 | Enumerate Illinois licenses/registrations required for an online end-to-end brokerage (entity + branches + MLOs) | unverified | needs the Illinois checklist (NMLS Resource Center) — the guidebook is system policy, not state law (R4); if unreachable from a session, this is a founder lookup ask | 2026-08-17 |
| CW-IL.2 | Illinois-specific bond amount, fees, and filing prerequisites | unverified | needs the Illinois checklist — never guessed | 2026-08-17 |
| CW-IL.3 | Product surfaces legally required before Illinois origination (license display, disclosures, advertising rules vs. the existing pre-license marketing gate) | unverified | Phase 2 gap check vs. `shared/companyIdentity.ts` + SEO gate; state rules control | 2026-08-17 |

## California (launch state 2 — staged, not started)

| id | item | status | evidence / cite | baseline |
|---|---|---|---|---|
| CW-CA.1 | Enumerate California licensing path(s) for the same business model — **research only until Illinois is live** (CHARTER §1a) | unverified | needs the California checklist(s); note CA has more than one possible regulator/regime — enumerate, do not choose: regime choice is a founder decision with counsel (L4-adjacent) | 2026-08-17 |

## National (gated on business performance — do not populate speculatively)

No rows until the founder names the next state (CHARTER §1a: never speculative).
