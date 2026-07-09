# UAL Lender-Channel Validation — Can a Broker Actually Route Halal Files?

**Type:** exploratory research · **Dated:** 2026-07-09 · **Owner:** engineering (primary-source scan)

> **Companion to [UNIVERSAL_ADAPTATION_LAYER.md](UNIVERSAL_ADAPTATION_LAYER.md).** Same status:
> below the L1 cut-line, a **post-launch future moat**, authorizes nothing. This doc validates the
> one load-bearing assumption of the broker-triage thesis and **re-points the target lenders** —
> it does not commit scope or touch the launch.

## The question

The UAL map's whole thesis is: *Homiquity brokers a halal file to a legacy lender who holds the
title, the licenses, and the GSE approvals.* That only works if such a lender **has a wholesale /
third-party-originator (TPO) channel a broker can submit into.** This is a make-or-break
assumption. I checked it against primary/near-primary web sources (July 2026).

## Headline

**Directionally viable, but the UAL doc named the wrong lenders.** The providers it lists
(UIF, Devon, Guidance) are **retail / bank-direct with no broker channel**. The route that *does*
work — a **facilitator + conventional-wholesale-lender ecosystem** — already exists and operates
nationally, which both **de-risks** the moat (the model is proven) and **re-risks** it (an
incumbent, Ijara CDC, already runs it).

## What I found

| Provider | Structure | Channel | GSE tie | Broker-accessible? | Source |
|---|---|---|---|---|---|
| **University Bank / UIF** | Musharaka (also Murabaha) | Retail / bank-direct | **$100M Freddie Mac master purchase commitment** (2006, Murabaha, MI-only) — private/negotiated | **No** wholesale/TPO channel found | [university-bank.com](https://www.university-bank.com/2006/02/20/university-bank-signs-100000000-shariaa-home-acquisition-master-commitment-with-freddie-mac/), [myuif.com](https://myuif.com/home-financing/) |
| **Devon Bank** | Murabaha (Ijara/Musharaka) | Retail / bank-direct, ~34 states | Own Freddie Mac relationship | **No** broker channel found | [devonbank.com](https://www.devonbank.com/faith-based-financing/) |
| **Guidance Residential** | Musharaka (declining balance) | Retail / non-bank direct | Historically Freddie Mac (co-ownership) | **No** wholesale/broker channel found | [guidanceresidential.com](https://www.guidanceresidential.com/resources/home-buying/why-is-guidance-residential-not-a-bank-and-where-do-you-get-our-funds-from/) |
| **Ijara CDC** | Ijara (lease-to-own via trust) | **Facilitator** — routes to funders | Funders pair with GSE/FHA/VA | **Yes (as a partner model)** — 100+ residential funders, all 50 states | [ijaracdc.com](https://ijaracdc.com/how-it-works/) |
| **CMG Financial** | Ijara-wa-Iqtina (via Ijara CDC) | Retail **+ a wholesale/TPO channel** | "Pairs with any eligible Fannie Mae product + FHA/VA" | **Plausibly — via TPO (unverified, see below)** | [cmgfi.com/loan-programs/halal-financing](https://www.cmgfi.com/loan-programs/halal-financing), [cmgfi.com/wholesale](https://www.cmgfi.com/wholesale) |

### 1. The named legacy providers are retail — and their GSE access is *private*
University Bank/UIF's Freddie Mac arrangement is a **$100M master purchase commitment**, launched
Michigan-only — a privately negotiated commitment, not an open channel. Devon has its own Freddie
relationship. This **confirms UAL §5.5**: these variances are proprietary and exclusive; a startup
cannot inherit them. All three are direct-to-consumer, and none surfaced a broker/wholesale desk.
*(Confidence: high they are retail; "no broker channel" is absence-of-evidence — worth one
confirming call each, but consistent across sources.)*

### 2. The broker-triage model already exists — Ijara CDC + conventional wholesale
**Ijara CDC** is a **501(c)(3) nonprofit**, explicitly "not a bank, lender or broker." It
**structures the Ijara trust, administers payments, and finds the borrower "the most economical
investor"** from **100+ residential funding partners across all 50 states.** It holds title via an
**inter-vivos revocable trust with the borrower as trustee** — which is precisely how it sidesteps
the broker-title / landlord-liability trap the UAL doc's §1 warns about. This is, in substance, the
UAL's own "route to a funder" model — already national.

**CMG Financial** — a large lender **with a wholesale/TPO arm** — offers a national **Halal
Financing Program (Ijara-wa-Iqtina, via Ijara CDC)** that "pairs with any eligible Fannie Mae
product as well as FHA and VA." US Bank is also cited (source manifesto) as an Ijara CDC funder.

### 3. Can a broker plug in? — the one thing still to verify
**Plausibly yes, via the Ijara-CDC + conventional-wholesale path (e.g. CMG's TPO channel), and
NOT via UIF/Devon/Guidance.** But: CMG's halal **program page is retail-framed** ("contact a local
loan officer") and does **not** confirm the halal product is originatable through TPO. The
"available to brokers via wholesale" phrasing came from **search synthesis, not the primary page**
— **treat as UNVERIFIED.**

> **Highest-value next action (founder, two calls):**
> 1. **CMG wholesale AE** — is the **Halal program originatable by approved brokers via TPO**?
>    Overlays, eligible states, packet requirements?
> 2. **Ijara CDC partnerships** — can an originator/broker **partner to feed deals**, and what is
>    the intake spec (docs, structure, servicing hand-off)?
>
> These two answers close the make-or-break question. Everything past them is contingent on a "yes."

### 4. Licensing / title — confirms UAL §5.2 & §5.9
Every workable model **avoids a for-profit broker holding title**: UIF/Devon use bank powers,
Ijara CDC uses a nonprofit trust (borrower-as-trustee), Guidance is a licensed non-bank lender.
Homiquity's clean path is a **state-licensed mortgage broker acting as a tech/intake layer feeding
the ecosystem** — never the title-holder. (State SAFE broker licensure per state remains the real
open licensing item.)

### 5. Competitive reality
A comparison / marketplace **content** layer already exists ([halalwallet.us](https://www.halalwallet.us/home-financing),
zoya.finance, halalworthy). The unoccupied wedge is **digital self-employed / 1099 normalization +
speed** feeding the existing funder ecosystem — i.e. exactly the **ARUE** value in the UAL doc, not
"be the first halal marketplace."

## Strategic implication

Homiquity's realistic halal moat = **a digital intake/triage layer that packages self-employed /
1099 halal borrowers and hands them to the Ijara-CDC + conventional-wholesale ecosystem (CMG,
US Bank) via a broker/TPO relationship — as a licensed broker, not a title-holder.** This re-points
the UAL map away from UIF/Devon/Guidance. It is still a **post-launch** moat and still gated on the
two verification calls above.

## Sources
- University Bank / Freddie Mac master commitment — <https://www.university-bank.com/2006/02/20/university-bank-signs-100000000-shariaa-home-acquisition-master-commitment-with-freddie-mac/>
- UIF home financing — <https://myuif.com/home-financing/>
- Devon Bank faith-based financing — <https://www.devonbank.com/faith-based-financing/>
- Guidance Residential (non-bank / funding) — <https://www.guidanceresidential.com/resources/home-buying/why-is-guidance-residential-not-a-bank-and-where-do-you-get-our-funds-from/>
- Ijara CDC — how it works — <https://ijaracdc.com/how-it-works/>
- CMG Halal Financing — <https://www.cmgfi.com/loan-programs/halal-financing>
- CMG Wholesale — <https://www.cmgfi.com/wholesale>
- Halal provider comparison — <https://www.halalwallet.us/home-financing>
