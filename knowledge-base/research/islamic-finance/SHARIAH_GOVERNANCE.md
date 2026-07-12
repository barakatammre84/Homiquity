# UAL Shariah Governance — Does a Broker-Triage Layer Need Its Own Board?

**Type:** exploratory research · **Dated:** 2026-07-09 · **Owner:** engineering (primary-source scan)

> **Companion to [UNIVERSAL_ADAPTATION_LAYER.md](UNIVERSAL_ADAPTATION_LAYER.md) and
> [LENDER_CHANNEL_VALIDATION.md](LENDER_CHANNEL_VALIDATION.md).** Same status: below the L1
> cut-line, a **post-launch future moat**, authorizes nothing. This validates the Shariah-board
> requirement; it does not commit scope or touch the launch.

## The question

A halal product needs a **Shariah Supervisory Board / fatwa** to certify the structure. That is a
hard requirement, a real cost, and a scholar relationship — and it hadn't been scoped. Does
Homiquity's **broker-triage** moat need to stand up its own board, what do the incumbents have, and
what does a startup **build vs. borrow**?

## Headline

**Like title-holding and GSE approvals, Shariah certification of the *structure* stays with the
funder.** Homiquity does not need a board to certify a contract it doesn't originate. Its only
owned Shariah item is **marketing-integrity** — never misrepresenting compliance — plus, optionally
when live, a **light process endorsement**. This reinforces the broker-triage firewall.

## What I found

### 1. The standard and the US body
- **AAOIFI** (Accounting and Auditing Organization for Islamic Financial Institutions) is the global
  standard-setter; **GS-1** governs Shariah Supervisory Board appointment, composition, and report.
- **AMJA** (Assembly of Muslim Jurists of America) is the key **US** endorsing/fatwa body — it
  issues resolutions on US Islamic home-financing companies.

### 2. Incumbent boards — every provider bears its own

| Provider | Board / authority | Notes |
|---|---|---|
| **Guidance Residential** | Independent board **chaired by Justice Muhammad Taqi Usmani** (AAOIFI Shariah Board chairman) + Dr. Abdul Sattar Abu Ghuddah | Musharakah Mutanaqisah; **AMJA-endorsed**. Top-tier, expensive, hard to replicate. |
| **Devon Bank** | **Shariah Supervisory Board of America** (Chicago), led by Mufti Muhammad Nawal-ur-Rahman | Scholars **volunteer (unpaid)**; issued a fatwa on the murabaha/ijara **products** after requested changes. Page certifies product structures, not third-party intermediaries. |
| **Ijara CDC** | Muftis Muneer Akhoon & Mohammed Umer Esmail | Certifies the Ijara trust structure it administers. |
| **UIF** | Publishes fatawa | Bank subsidiary. |

### 3. AMJA's stance is cautious — and it speaks to intermediaries
The **2014 AMJA Resident Fatwa Committee resolution** treats even the compliant companies as a
**"permissible in the case of need"** exemption — the whole category is under ongoing scholarly
scrutiny, so an unqualified "100% halal" claim is itself contested. Critically, for **Mubarak
Mortgage**, AMJA "reviewed the murabaha contract, believes it is Sharia-compliant, and **advises the
company to appoint an independent Sharia supervisory board to ensure proper implementation.**"
→ *A firm in the transaction is expected to have Shariah oversight of its own **implementation**,
even when the **structure** is already certified.*

### 4. Borrow, don't build — the advisory-firm path
Shariah advisory firms — **Amanie Advisors**, **Shariyah Review Bureau**, **Amanah Advisors** —
provide **product-level or entity-level certification** plus a **Shariah Governance Framework**,
reviewed against AAOIFI standards, with annual audit. **Cost is not published** (custom — verify by
direct contact). This is how a fintech obtains oversight without recruiting a standing board of
Taqi-Usmani-caliber scholars.

**Precedent — a full-stack halal fintech carries all three layers.** **Manzil** (Canadian Islamic
fintech, now expanding to the US) runs its **own Shariah supervisory board + internal & external
Sharia auditors + a third-party Sharia advisory firm**, and is AAOIFI-compliant. That is the
governance load of a **manufacturer** (Manzil originates the structures). It reinforces the split:
if Homiquity ever *manufactures*, it inherits Manzil-level board overhead; as a **broker-triage
intermediary**, it relies on the funder's certification (pending the advisor + counsel confirmation
below). Manzil is also a **competitor** — see [LENDER_CHANNEL_VALIDATION.md](LENDER_CHANNEL_VALIDATION.md) §5.

## Strategic conclusion for broker-triage

- **Structure certification = the funder's burden.** Homiquity relies on the funder's existing board
  (Ijara CDC / CMG-via-Ijara / Guidance); it does **not** need its own board to certify a structure
  it does not originate. Consistent with the title / GSE / disclosure firewall.
- **Homiquity's owned Shariah item = marketing-integrity.** Name the funder's certification; **never
  claim Homiquity's own Shariah compliance of the structure.** A "halal" claim is simultaneously a
  **religious-representation** risk and an **ECOA / fair-housing** one (ties to UAL §5.8).
- **Optional when live — a light process/implementation endorsement** (an advisory firm or an
  AMJA-affiliated scholar reviewing Homiquity's *intake and representations*, not the contract) for
  community credibility. Borrow, don't build. The standing board stays with the funder — another
  reason not to be the funder.

> **Confidence / caveat.** "A broker does not need its own *structure* board" is a **strong
> inference** from AMJA's originator-vs-intermediary guidance and the funder-owns-the-structure
> reality — but it is a **religious *and* legal determination**. **Confirm with a Shariah advisor
> *and* counsel** before relying on it; do not treat it as settled.

## Still open (verify before promotion)
1. **Advisory-firm cost** — one call to Amanie / Shariyah Review Bureau for a process-endorsement quote.
2. **Does a broker specifically need its own board?** — Shariah advisor + counsel confirmation.
3. **Current AMJA stance** — the resolution is 2014; check for an updated resolution.

## Sources
- AMJA resolution on US Islamic home financing — <https://www.amjaonline.org/amja-resident-fatwa-committee-resolution-about-islamic-home-financing-companies-in-the-us>
- AMJA — Islamic Home Financing fatwa — <https://www.amjaonline.org/fatwa/en/22320/islamic-home-financing>
- Guidance Residential — independent Shariah board — <https://www.guidanceresidential.com/shariah-board>
- Devon Bank — Shariah board approval — <https://www.devonbank.com/shariah-board-approval/>
- AAOIFI GS-1 (Shariah Supervisory Board) — <https://aaoifi.com/aaoifi-gs-1-sharia-supervisory-board-appointment-composition-and-report/?lang=en>
- Amanie Advisors — Shariah advisory/consultancy — <https://amanieadvisors.com/shariah-advisory-consultancy/>
- Shariyah Review Bureau — services — <https://shariyah.net/services/>
- Manzil — Shariah governance (own board + auditors + third-party advisory) / US expansion — <https://betakit.com/manzil-wants-to-become-the-north-american-islamic-neobank-as-it-expands-to-the-us/>
