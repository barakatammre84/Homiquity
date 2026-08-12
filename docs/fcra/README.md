# FCRA / Regulation V reference documents

Authoritative reference material for every reading in this repo that concerns **furnishing**
consumer information to a credit reporting agency, and for the consumer-facing obligations that
attach once we do.

Per [CLAUDE.md](../../CLAUDE.md), regulated logic is never written from memory. This directory
exists so the furnisher side of FCRA gets the same treatment [`docs/fannie-mae/`](../fannie-mae/)
and [`docs/nmls/`](../nmls/) already give their domains.

## The distinction that makes this directory necessary

The repo already implements a substantial amount of FCRA — **all of it on the *user* side.**
Adverse-action notices under §615(a), bureau attribution, consent scope, and retention live in
`server/services/creditAdverseActions.ts` and `server/services/creditPulls.ts`, and are covered
by `tests/adverseActionNotice.test.ts` and `tests/adverseActionFcraChokepoint.test.ts`.

The rent-reporting program makes Homiquity a **furnisher** for the first time. That is a
different statutory role with different duties, and *none* of the existing code or tests speak
to it. Before this program, `furnisher`, `1681s-2`, `eOSCAR`, and `ACDV` had **zero occurrences
repo-wide**; the only hits for "furnishing" were the adverse-action sense of *which bureau
furnished the report we read*.

> ## ⚠️ Local inventory is EMPTY
>
> Every authoritative source is unreachable from the agent environments this repo is developed
> in — the same blocked-host list recorded in [`docs/reg-z/README.md`](../reg-z/README.md)
> (`ecfr.gov`, `consumerfinance.gov`, `govinfo.gov`, `law.cornell.edu`, `uscode.house.gov`,
> `federalregister.gov`; verified 2026-08-04, re-verified 2026-08-05, all `CONNECT tunnel
> failed, 403`).
>
> **This cannot be worked around from inside a session.** A human has to place these documents
> here once.

## Document hierarchy

1. **The statute controls** — the Fair Credit Reporting Act, 15 U.S.C. §1681 et seq.,
   particularly **§1681s-2** (responsibilities of furnishers) and **§1681i** (dispute
   procedures).
2. **Regulation V implements it** — 12 CFR Part 1022, particularly **§§1022.40–1022.43** and
   **Appendix E** (the interagency accuracy-and-integrity guidelines), which is the provision
   that governs whether our rent data is furnishable at all.
3. **CFPB compliance guides and bulletins** are navigation aids, not authority.
4. **State analogues may be stricter** — several states have their own credit-reporting and
   credit-services statutes. State law controls where it is more protective; escalate rather
   than picking a side.

## What to obtain

| Artifact | Sections that matter here | Status |
|---|---|---|
| **15 U.S.C. §1681** (FCRA, current) | **§1681s-2(a)** accuracy duties and the duty to correct; **§1681s-2(b)** duties on notice of dispute; **§1681i** CRA dispute procedures; **§1681c** obsolescence | ❌ absent |
| **12 CFR Part 1022** (Regulation V) + **Appendix E** | **§§1022.40–.43** — furnisher accuracy and integrity policies, direct disputes, and what a furnisher's written policies must cover; **Appendix E** guidelines | ❌ absent |
| **15 U.S.C. §1679** (CROA) | Whether a subscription positioned as credit improvement falls in scope, and the advance-payment prohibition | ❌ absent |
| **e-OSCAR / ACDV furnisher documentation** | The operational dispute-response system a furnisher must be able to receive and answer through | ❌ absent |

The safest single artifacts are a current annual-edition PDF of **12 CFR Part 1022** and the
current **15 U.S.C. Chapter 41, Subchapter III** text. Drop them here, then add a
**Local inventory** section with a section→page map following
[`docs/nmls/README.md`](../nmls/README.md).

## The decisions blocked on it

| Decision | What the source settles | Code |
|---|---|---|
| May a rent payment be furnished at all, and on what evidentiary basis? | Reg V Appendix E accuracy-and-integrity guidelines — the standard our `provenance` values must clear | `shared/schema/rent.ts` (`rent_payments.provenance`), `server/services/rentFurnishing.ts` |
| Is a bank-observed (inferred) payment furnishable, or only a platform-processed one? | Appendix E; §1681s-2(a) accuracy duty | `server/services/rentFurnishing.ts` (provenance gate) |
| May 24 months of *retroactive* rent history be furnished? | §1681s-2(a) accuracy duty applied to history we never observed | not built — see the plan's "explicitly not built" |
| What written policies and procedures must exist before the first furnish? | §1022.42 and Appendix E | ops artifact, not code |
| What is the required dispute-response path and its deadline? | §1681s-2(b), §1681i, §1022.43 (direct disputes) | `server/services/rentFurnishing.ts` (dispute intake), `rent_furnishing_queue` `disputed` state |
| May the subscription be charged before any tradeline is furnished? | CROA §1679b(b) advance-payment prohibition; UDAAP | billing — **not built**; plan assumes no charge until first successful furnish |
| Must a consumer be able to withdraw and have the tradeline deleted? | §1681s-2(a) correction/deletion duties | `rent_furnishing_queue` `suppressed` state |

## Standing constraint until these land

The repo's binding rule from the 2026-08-04 cross-sector adjudication — **"no machine-issued
financial attestations to third parties"** — is directly on point: a furnished tradeline *is* a
machine-issued financial attestation about a consumer, sent to a third party, that affects their
access to credit. The rent-reporting program is the first sanctioned exception to that rule, and
the exception is conditioned on this corpus existing. Until it does:

- **Nothing is transmitted to any bureau.** The furnishing queue accumulates state and performs
  no I/O (`server/services/rentFurnishing.ts`).
- **No consumer is charged.** See the CROA row above.
- **The `bank_observed` provenance value is not furnishable.** Only `platform_processed`
  first-party records are queue-eligible, because an inferred payment cannot be defended under
  an accuracy duty we have not yet read.

## Once the documents are here

1. Add a **Local inventory** section with a section→page map.
2. Work the blocked-decision table. For each, update the corresponding entry in
   [`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json):
   drop "VERIFICATION PENDING" from `citation`, set `lastVerified`, reset `reviewIntervalDays`
   to **180**, and point `sourceUrl` at the local file rather than a blocked host.
3. Where a reading turns out to be wrong, the correction ships as its own change with its own
   tests — never as a quiet ledger edit.
