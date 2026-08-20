# Illustration & motion brief — what to commission

> Written 2026-08-20 from a live teardown of monzo.com and monzo.com/savings.
> The **mechanism** is built (`client/src/components/motion/Scene.tsx`). The
> **artwork is not, and cannot be produced in-session** — it is a commission.
> This is the spec to hand an illustrator/motion designer.

## What the reference actually does

Measured, not assumed. Their home page carries **27** of these; the savings page **12**.

| | Finding |
|---|---|
| Format | Short **`.webm`**, `muted`, `loop`, `playsInline`, **`autoplay={false}`** |
| Trigger | JavaScript plays it on scroll-into-view, pauses it on exit |
| Still | A square **poster** image served as **avif**, `?w=864&q=75` for a 288–320px slot (3× for retina) |
| Loading | Hero `loading="eager" decoding="sync"`; everything below the fold `lazy`/`async` |
| Not used | **Zero** Lottie, **zero** SVG SMIL, **zero** CSS keyframe character animation |

Video wins because illustrated character animation has far too many moving parts
to express as vectors at a sane file size. One CSS animation exists on their whole
page and it is a scroll-reveal — the same thing as our `Reveal`.

## What to commission

**Format:** square 1:1. Deliver a `.webm` (VP9, muted, seamless loop, 2–5s) **plus**
a matching `_poster.png` still at 864×864. The poster must be the loop's resting
frame, because it is the base layer the video fades in over — a poster that differs
from frame one produces a visible jump.

**Quantity to start: four**, one per journey door — renting · self-employed ·
already own · moving up. Prove the pattern before commissioning a set.

**Subject:** the borrower's world, not generic finance stock. A first key. A tax
return with more pages than expected. A second home with the first one still
attached. What the money means, not the money.

**Motion:** small and looping. One or two elements move; the scene does not
travel. Motion that announces itself dates within a year.

🚨 **Original artwork only.** The reference's illustrations are their
illustrator's copyrighted work — study the approach, never trace, re-colour or
re-time their assets. The technique is portable; the drawings are not.

## Constraints the assets must respect

- **Fair Housing.** People shown in marketing imagery follow the same
  representation rule as `client/src/lib/lifestyleImages.ts` — swap like-for-like.
- **Reduced motion.** `Scene` omits the video element entirely; the poster carries
  the whole meaning on its own. Judge every still as if the loop never plays.
- **Weight.** These sit in lazy route chunks, but a 2 MB loop is still 2 MB on a
  phone. Target **< 300 KB** per webm.
- **`alt` text** describes the illustration, or is `""` when it sits decoratively
  beside a heading that already says it.

## Status

Mechanism: **built and tested** — poster-always, video-on-intersection,
pause-off-screen, omitted under reduced motion, `preload="none"`.
Assets: **none**. Until they exist, `Scene` renders a still, and the six Unsplash
photos in `lifestyleImages.ts` are still what the site ships.
