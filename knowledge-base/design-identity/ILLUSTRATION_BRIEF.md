# Illustration brief — what to commission, and why

> Written 2026-08-20 from live teardowns of monzo.com, /savings and /loans.
> The **mechanism is built**; the **artwork is a commission** and cannot be
> produced in-session. This is the document to hand an illustrator.

## The correction that produced this version

The first version of this brief was written from the home page and the savings
page, which carry **27** and **12** short looping videos respectively. It
concluded that the commission was "animated scenes" and specified exactly one
deliverable: a `.webm` plus a poster still, four of them, one per journey door.

Then `/loans` was measured. It carries **zero videos.** It carries:

| Asset | Format | Natural size | Rendered | Job |
|---|---|---|---|---|
| `Loans_Hero.svg` | **SVG** | 520 × 294 | 264 × 149 | one hero illustration |
| `Quick_and_simple.png` &c. | **PNG** | — | **36 × 36** | one spot icon per benefit |
| `Group_2.png` | avif-served | — | 240 × 363 | a portrait device scene |

**So the reference does not have an illustration style. It has an illustration
*system* — three tiers, each with its own format, ratio and job.** Video is
reserved for a couple of flagship pages; the workhorse tier across the site is a
static vector hero, and the tier that appears most often is a 36px spot icon.

That matters because of which complaint each tier answers. The original
complaint was *"the icons seem very generic."* The old brief commissioned
**zero icons**. It spent the entire budget on the most expensive tier, for four
tiles on one page, and left the thing actually being complained about untouched.

## The three tiers

Commission them in this order. Tier 1 is the cheapest and fixes the loudest
problem; Tier 3 is the most expensive and the most replaceable.

### Tier 1 — Spot icons · highest value, lowest cost

**The brief's priority.** 36–48px, square, one per marketing benefit or feature
row. These are small bespoke drawings, not glyphs.

- **Deliver:** SVG preferred; PNG at 144×144 (4× for retina) accepted.
- **Quantity to start: six.** See the subject list below.
- **Read at 36px or they have failed.** Judge every one zoomed out, not zoomed
  in. Detail that disappears at 36px is cost with no return.

🚨 **These do not replace the 44-concept UI icon registry** (`client/src/lib/icons.ts`).
Those are Lucide glyphs rendering at 16px inline in tables, buttons and form
rows, and a painterly 36px drawing is illegible there. The reference does the
same thing — it runs 42px SVG glyphs *and* 36px spot illustrations side by side,
because they are different jobs. Tier 1 is **marketing surfaces only**.

### Tier 2 — Journey scenes · the four doors

Landscape, roughly 16:9. Supply **~1024px on the long edge**; the tile renders
300–400px wide, so that is comfortably 3× for retina.

- **Deliver:** `<id>_poster.png` — **required**, and it must stand alone.
- **Optionally** `<id>.webm` (VP9, muted, seamless 2–5s loop, **< 300 KB**).
- The poster must be **the loop's resting frame**. `Scene` layers the video over
  the poster as its base layer, so a poster that differs from frame one produces
  a visible jump when the loop starts.
- Nothing is cropped — `Scene` preserves whatever ratio it is given.

> An earlier version of this brief specified **square** because every scene on
> the reference's home page is square. The first real asset arrived at 1024×576
> and a square box would have cropped it through the middle of the roof.
> **Copying a reference's asset dimensions is not the same as copying its
> technique.** Only the technique was worth taking.

### Tier 3 — Page hero · one per marketing page

Landscape vector, ~16:9, **SVG**. This is the large illustration at the top of a
page. Vector because it is flat/line art that must scale from 264px to full
width without a raster tier for each breakpoint.

Commission this **last**, and only after Tier 1 has proved the style works.

## Subjects

The borrower's world, not generic finance stock. **What the money means, not the
money.** No coin stacks, no rising bar charts, no handshakes, no piggy banks.

**Tier 1 spot icons (six, to start):**

1. Income that isn't a salary — a tax return thicker than expected
2. A rate that moves — the same thing priced two ways
3. A document you already sent — a paper that stays put once handed over
4. Time — a process with a visible end, not a spinner
5. A question answered plainly — a person, not a chatbot glyph
6. A file that follows you — one folder, many doors

**Tier 2 journey scenes (four, matching the home page doors):**

| Id | Subject |
|---|---|
| `renting` | A rented flat, keys resting on the counter — the rent that is already being paid |
| `self-employed` | A desk: business return, laptop, coffee. Work that pays irregularly |
| `owner` | A house with a second, smaller house beside it |
| `moving-up` | A larger home, a moving box on the doorstep |

## Palette — the actual tokens

Draw in these. They are the values in `client/src/index.css`, so artwork made
from them sits on our grounds without adjustment.

| Role | Hex | Notes |
|---|---|---|
| Ground (white) | `#FFFFFF` | the bands most art sits on |
| Ground (mint) | `#E2F4EC` | the hero band and alternating sections |
| Ink | `#0B1E19` | near-black, green-biased — line work |
| Deep | `#17302A` | the dark footer ground |
| Primary | `#047756` | emerald — the brand's one committed hue |
| Flare | `#DD610E` | orange accent, **used sparingly** |
| Muted text | `#5A726C` | |
| Hairline | `#E2E9E7` | |

**Flare is the accent, not a second brand colour.** One or two elements per
illustration, never a fill. If a drawing reads as orange, it is wrong.

Illustrations must work on **both** the white and the mint ground — check every
asset on both before delivering. Transparent background, always.

## Hard constraints

🚨 **Original artwork only.** The reference's illustrations are their
illustrator's copyrighted work. Study the approach; never trace, re-colour or
re-time their assets. **The technique is portable, the drawings are not.**
Homiquity must also stay visually distinguishable from Monzo — same sector,
and a broker that looks like a bank is a trade-dress problem as well as a
positioning one.

🚨 **Homiquity is a broker, not a lender.** Nothing may depict Homiquity
approving, deciding, funding, or handing over money or keys. No stamps of
approval, no "approved" marks, no cheque being passed, no vault, no bank
building with our name on it. A lender decides; we prepare the file and
advocate. Artwork that implies otherwise is a Reg N / advertising problem, not
a taste problem — and it is the single easiest way for a well-meaning
illustration to create a compliance defect.

🚨 **Fair Housing.** Any depiction of people follows the same representation
rule as `client/src/lib/lifestyleImages.ts` — swap like-for-like, and never let
a life stage, family shape or neighbourhood read as who the product is *for*.
Where a scene works without people, prefer that.

**Accessibility, and it is not optional:**

- **Reduced motion:** `Scene` omits the video element entirely for visitors who
  ask for reduced motion. **The poster carries the whole meaning alone.** Judge
  every still as if the loop never plays, because for those visitors it never does.
- **No text inside artwork.** It cannot be translated, selected, read by a
  screen reader, or resized by a visitor who needs larger type.
- **Contrast:** any element carrying meaning needs 3:1 against the ground behind
  it. Decorative detail may be lighter.
- Every asset gets `alt` text describing it, or `""` when it sits decoratively
  beside a heading that already says the same thing.

## Delivery — filenames are the whole API

Drop files in `attached_assets/scenes/`. **No code change is needed** — Vite
discovers them at build time, so a missing file is an absent key rather than a
broken import.

```
attached_assets/scenes/renting_poster.png     # Tier 2 still   (required)
attached_assets/scenes/renting.webm           # Tier 2 loop    (optional)
```

Valid Tier 2 ids: `renting` · `self-employed` · `owner` · `moving-up`.
A poster with no webm renders as a still picture — **a perfectly good outcome.**
The loop is an enhancement, never a dependency.

## Status

| | |
|---|---|
| Tier 2 mechanism | **built and tested** — poster-always, video-on-intersection, pause-off-screen, omitted under reduced motion, `preload="none"`, WCAG 2.2.2 pause control |
| Tier 1 / Tier 3 mechanism | see `spotArt.ts` — falls back to the Lucide glyph until art arrives |
| Artwork | **none.** Until it exists the site ships Lucide glyphs and six Unsplash photos |
