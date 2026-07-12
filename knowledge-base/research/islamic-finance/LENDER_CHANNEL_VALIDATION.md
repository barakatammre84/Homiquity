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

> **Update 2026-07-09 (deeper channel pass) — the optimism is tempered.** A second look at the two
> access points weakens the "plausibly yes": CMG's **wholesale** product list is Conventional /
> Government / All-In-One with **no Halal/Ijara** (the halal program page is retail-framed), and
> Ijara CDC's only advertised partner program is a **Preferred *Realtor* Program** — no
> broker-originator channel. So public signals now lean **retail-direct + realtor-referral, not
> broker-originator TPO.** The two founder calls below are no longer "nice to confirm" — they are
> **hard gates**, and the working assumption should be cautious. See §5 for a new digital competitor
> (**Manzil**). *(Still public-evidence-leans, not proven negatives — absence of a channel on a
> website is not a "no.")*

## What I found

| Provider | Structure | Channel | GSE tie | Broker-accessible? | Source |
|---|---|---|---|---|---|
| **University Bank / UIF** | Musharaka (also Murabaha) | Retail / bank-direct | **$100M Freddie Mac master purchase commitment** (2006, Murabaha, MI-only) — private/negotiated | **No** wholesale/TPO channel found | [university-bank.com](https://www.university-bank.com/2006/02/20/university-bank-signs-100000000-shariaa-home-acquisition-master-commitment-with-freddie-mac/), [myuif.com](https://myuif.com/home-financing/) |
| **Devon Bank** | Murabaha (Ijara/Musharaka) | Retail / bank-direct, ~34 states | Own Freddie Mac relationship | **No** broker channel found | [devonbank.com](https://www.devonbank.com/faith-based-financing/) |
| **Guidance Residential** | Musharaka (declining balance) | Retail / non-bank direct | Historically Freddie Mac (co-ownership) | **No** wholesale/broker channel found | [guidanceresidential.com](https://www.guidanceresidential.com/resources/home-buying/why-is-guidance-residential-not-a-bank-and-where-do-you-get-our-funds-from/) |
| **Ijara CDC** | Ijara (lease-to-own via trust) | **Facilitator** — routes to funders | Funders pair with GSE/FHA/VA | Partner program is **realtor-facing**; **no broker-originator path advertised** (call to confirm) | [ijaracdc.com](https://ijaracdc.com/how-it-works/), [preferred-professionals](https://ijaracdc.com/preferred-professionals/) |
| **CMG Financial** | Ijara-wa-Iqtina (via Ijara CDC) | Retail; separate wholesale/TPO channel | "Pairs with any eligible Fannie Mae product + FHA/VA" | **Public signals lean RETAIL-ONLY** — halal absent from the wholesale product list (call to confirm) | [cmgfi.com/loan-programs/halal-financing](https://www.cmgfi.com/loan-programs/halal-financing), [cmgfi.com/wholesale](https://www.cmgfi.com/wholesale) |

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

### 3. Can a broker plug in? — public signals now lean *no* on the advertised channels
Original read was "plausibly yes via CMG's TPO channel." **The deeper pass weakens that:**
- **CMG** — the wholesale channel's product list is **Conventional / Government / All-In-One**; the
  **Halal program does not appear in wholesale** and its own page routes to "a local loan officer."
  → halal is **likely retail-only** at CMG (call to confirm).
- **Ijara CDC** — the only advertised partner program is a **Preferred *Realtor* Program**
  (marketing + access to pre-approved buyers); **no mortgage-broker / loan-originator "feed us
  deals" channel** is offered. Consumers come direct or via a realtor.

So the honest status is **not** "plausibly yes" but **"the advertised channels are retail-direct +
realtor-referral; a broker-originator path is unconfirmed and looks unlikely."** Absence on a website
is not a definitive "no" — but the burden is now on the two calls to find a *yes*.

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

**Digital-first competitor entering (2026): Manzil.** The Canadian Islamic fintech **Manzil** has
originated **$100M+ CAD in halal mortgages** (~240 households, Musharaka), is **AAOIFI-compliant with
its own Shariah board + internal/external auditors + a third-party advisory firm**, and is
**expanding to the US** — Manzil Invest USA is live (via the Aghaz acquisition) and **mortgages are
explicitly on its roadmap** ("Manzil Communities" breaks ground early 2026). This narrows the exact
"digital speed" wedge above: the moat's edge is no longer "first digital halal player" but must be a
specific, defensible advantage (e.g. self-employed/1099 depth, or a broker's multi-funder neutrality
if the channel calls come back "yes").

## Strategic implication

Homiquity's realistic halal moat = **a digital intake/triage layer that packages self-employed /
1099 halal borrowers and hands them to the Ijara-CDC + conventional-wholesale ecosystem (CMG,
US Bank) — as a licensed broker, not a title-holder.** This re-points the UAL map away from
UIF/Devon/Guidance. **But the deeper pass makes the broker→funder handoff the binding constraint:**
the advertised channels are retail-direct + realtor-referral, so the whole moat is contingent on the
two calls surfacing a broker-originator path that public sources don't show. If they come back "no,"
the moat needs a different shape (e.g. a realtor-referral tie-in, or a different funder). Still
**post-launch**, still gated on those calls — now with a competitor (Manzil) on the clock.

## Sources
- University Bank / Freddie Mac master commitment — <https://www.university-bank.com/2006/02/20/university-bank-signs-100000000-shariaa-home-acquisition-master-commitment-with-freddie-mac/>
- UIF home financing — <https://myuif.com/home-financing/>
- Devon Bank faith-based financing — <https://www.devonbank.com/faith-based-financing/>
- Guidance Residential (non-bank / funding) — <https://www.guidanceresidential.com/resources/home-buying/why-is-guidance-residential-not-a-bank-and-where-do-you-get-our-funds-from/>
- Ijara CDC — how it works — <https://ijaracdc.com/how-it-works/>
- CMG Halal Financing — <https://www.cmgfi.com/loan-programs/halal-financing>
- CMG Wholesale (product list: Conventional/Government/All-In-One) — <https://www.cmgfi.com/wholesale>
- Ijara CDC Preferred (Realtor) Professionals — <https://ijaracdc.com/preferred-professionals/>
- Manzil — US expansion (BetaKit) — <https://betakit.com/manzil-wants-to-become-the-north-american-islamic-neobank-as-it-expands-to-the-us/>
- Manzil — $100M CAD halal mortgages (BetaKit) — <https://betakit.com/manzil-surpasses-100-million-in-halal-mortgages-for-muslim-canadians/>
- Halal provider comparison — <https://www.halalwallet.us/home-financing>
