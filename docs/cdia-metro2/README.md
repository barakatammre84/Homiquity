# CDIA Metro 2® reference documents

Authoritative reference material for every Metro 2® reading in this repo — the fixed-width
record format used to furnish a consumer tradeline to the nationwide credit bureaus, and the
governing source for the rent-reporting program.

Per [CLAUDE.md](../../CLAUDE.md), regulated logic is never written from memory. This directory
exists so Metro 2® gets the same treatment [`docs/fannie-mae/`](../fannie-mae/) and
[`docs/nmls/`](../nmls/) already give their domains: a local, citable copy, so a field position,
length, or enumeration can be **verified** rather than **guessed**.

> ## ⚠️ Local inventory is EMPTY — and this one cannot be downloaded
>
> The Metro 2® Format Manual is **not a public document**. Unlike the Reg Z blocker in
> [`docs/reg-z/README.md`](../reg-z/README.md) — where the text is public and merely unreachable
> from agent environments — the CDIA manual is licensed by the Consumer Data Industry
> Association and distributed only to members and vetted data furnishers. No amount of network
> access from inside a session produces it.
>
> **Acquisition is a procurement action, not a fetch.** A human must complete CDIA membership /
> furnisher onboarding and place the manual here. Until then the compiler's field layout stays
> empty and throws, enforced by `tests/metro2Gate.test.ts`.

## Why guessing is worse here than elsewhere

Metro 2® is a fixed-width character format: every field has an exact byte offset, an exact
length, and a justification/fill rule. A layout invented from memory does not fail loudly — it
produces a well-formed-looking `.dat` file that the bureaus reject wholesale, or worse, one they
**accept** while the fields land in the wrong columns. The downstream artifact of that mistake
is not a failed build; it is inaccurate information on a real consumer's credit file, which is
the exact harm FCRA §623 and Reg V Appendix E exist to prevent (see [`docs/fcra/`](../fcra/)).

This is the same doctrine that governs MISMO field names in `docs/fannie-mae/` — *never invent
field names, enumerations, or container paths* — applied to a format where the failure mode is
worse, because the subject of the record is a consumer rather than a loan delivery.

## Document hierarchy

1. **The CDIA Metro 2® Format Manual controls the format** — record layouts, segment
   composition, field positions and lengths, and the valid enumerations for every coded field.
2. **Each bureau's own furnisher technical requirements** may add constraints on top of the
   manual (transmission, file naming, test-file certification, the active-tradeline minimum).
   Where a bureau requirement is stricter than the manual, the bureau controls for delivery to
   that bureau.
3. **FCRA §623 and Regulation V control what may be furnished at all** — see
   [`docs/fcra/`](../fcra/). The format manual answers *how to say it*; it never answers
   *whether we are permitted to say it*, and it is not evidence that a given data point is
   accurate or furnishable.

Where sources disagree, escalate to the user rather than picking an interpretation.

## What to obtain

| Artifact | Why | Status |
|---|---|---|
| **CDIA Metro 2® Format Manual** (current annual edition) | The format authority: base segment layout, field positions/lengths, coded-field enumerations, and the segment applicable to a rental tradeline | ❌ absent |
| **CDIA furnisher onboarding / membership packet** | The furnisher registration path and the active-tradeline minimum each bureau applies before accepting a new furnisher | ❌ absent |
| **Per-bureau furnisher technical specifications** (Equifax, Experian, TransUnion) | Transmission, file naming, test-file certification, and any bureau-specific deltas from the manual | ❌ absent |

Place the manual here with its edition in the filename so versions stay traceable (the
`docs/nmls/` convention), then add a **Local inventory** section with a section→page map
following [`docs/nmls/README.md`](../nmls/README.md).

## The decisions blocked on it

Each row is a decision the rent-reporting program cannot make without the manual. None of these
may be answered from memory, from a vendor blog post, or from a sample file found online.

| Decision | What the manual settles | Code |
|---|---|---|
| Base segment field layout | Every field's exact offset, length, justification, and fill character | `shared/lib/metro2/compiler.ts` (`FIELD_LAYOUT`, currently empty and throwing) |
| Record Descriptor Word | How the leading length descriptor is computed and encoded | `shared/lib/metro2/compiler.ts` |
| Account type for a rental tradeline | Which account-type code a rent obligation is furnished under, and whether a rental tradeline uses the base segment alone or requires an additional segment | `server/services/rentFurnishing.ts` |
| Account status + payment history profile | The valid status enumerations, and how a missed or partial month is encoded in the payment history profile | `server/services/rentFurnishing.ts` |
| Consumer identification fields | Which identifiers are required vs conditional, and their formats | `server/services/rentFurnishing.ts` |
| Header/trailer records | Whether they are required for our file class, and their composition | `shared/lib/metro2/compiler.ts` |
| Correction and deletion mechanics | How a previously furnished record is corrected or deleted after a dispute | `server/services/rentFurnishing.ts` (dispute path) |

**The pitch that started this program asserted "Account Type 3A (Unsecured rent)".** That value
is recorded here as an *unverified external claim*, not as a fact, and must not be coded against
until the manual confirms it. This is the same quarantine the repo applies to the Appendix A.2
non-QM program numbers (`tests/nonQmProgramGate.test.ts`).

## Once the document is here

1. Add a **Local inventory** section with a section→page map (see `docs/nmls/README.md`).
2. Populate `FIELD_LAYOUT` in `shared/lib/metro2/compiler.ts` from the manual, one field at a
   time, each carrying a `citation` naming the manual section and page it came from.
3. `tests/metro2Gate.test.ts` releases automatically once a citation file exists here — it is
   written to fail while the layout is populated *without* a local citation, so the manual's
   arrival is what unblocks the compiler, never a developer's recollection.
4. Work the blocked-decision table above, and update the corresponding entries in
   [`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json):
   drop "VERIFICATION PENDING" from `citation`, set `lastVerified`, and reset
   `reviewIntervalDays` to **180**.

Adding a document here is not itself a compliance decision. Confirming a field layout is — and
the first file transmitted to a bureau is a decision above this repo's pay grade regardless of
how green the tests are.
