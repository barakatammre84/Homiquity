# Design Identity Engine — cross-run ledger

One row per run. The routine **raises** the standard; the
[UI Conformance Sweep](../../.claude/skills/ui-conformance-sweep/SKILL.md) **spreads** it. Territory
split in [CHARTER §6a](../routines/CHARTER.md).

The `Refused` column is load-bearing. A direction this routine declined, **and why**, must not be
re-derived next run — most of the cost here is spent discovering that a reference's answer is wrong
for a broker, and that finding is worth more than the change it prevented.

| date | run | raised | proved on | refused, and why |
|---|---|---|---|---|
| 2026-08-20 | **0 — quality floor** | `prefers-reduced-motion` appeared in **zero files**; framer-motion ran in 8 of 411. WCAG 2.3.3. Added the global CSS floor at **`0.01ms`, not `0s`** — a zero-length animation may never dispatch `animationend`, and Radix unmount plus `AnimatePresence` both complete on that event, so `0s` stalls the state machine it was meant to calm. | app-wide | — |
| 2026-08-20 | **1 — tokens** | Palette rebuilt on measured structure, not invention: green-black ink, one mint tint, one flare accent. AA checked on every pair *before* it entered `index.css`. | Landing | **`--flare` as text.** It fails AA on every ground (mint 3.37, white 3.63, dark 3.88), so `--flare-ink` exists for text and flare stays fills and rules. |
| 2026-08-20 | **2 — motion primitives** | `Reveal`, `Stagger`, `StaggerItem` — three, deliberately not a library. Scattered one-off effects are what make a page read as assembled. | Landing | **A motion library.** Anything not expressible in three primitives probably should not be animated. |
| 2026-08-20 | **3 — `Scene` + illustration pipeline** | Poster-plus-loop, build-time auto-discovery. Drop a file in `attached_assets/scenes/`, it appears — no code change, no manifest. Proven end to end with a stand-in poster, then deleted. | Landing | **Copying the reference's square asset ratio.** Their scenes are 1:1 and an early version hard-coded `aspect-square`; the first real asset was 1024×576 and would have been cropped through the roof. **Copying asset dimensions is not copying technique.** |
| 2026-08-20 | **4 — WCAG 2.2.2 pause control** | A loop never ends, so it needs an in-page mechanism. Labelled by outcome ("Pause animations"), real text not an icon, 44px floor. | Landing | **Treating `prefers-reduced-motion` as sufficient.** It serves people who already set an OS preference; 2.2.2 asks for a control for everyone else. |
| 2026-08-22 | **5 — radius scale** | Six declared rungs, 4/8/12/16/24/32, all derived from `--radius`. **`rounded-xl` had been a silent no-op**: `theme.extend` overrode only sm/md/lg, so `xl` fell through to Tailwind's default `0.75rem` — identical to `--radius`. 40 files asked for a softer container and got nothing. Never went red, because a silent no-op is not an error. | app-wide | — |
| 2026-08-22 | **6 — band rhythm** | Sections separate by **changing the ground**, not drawing a hairline. Home page + four persona pages + three education pages. | 8 public pages | **Removing hairlines first.** The sequence was mint/white/white/white — three consecutive white sections where the hairline was the *only* separation. Alternate first, then remove; the naive order makes the page worse. |
| 2026-08-22 | **7 — `OffsetBlock`** | Blocks anchor left/right at `lg`, collapsing to centred below. Measured off a reference at 1440px: 4 of 6 blocks off-centre, alternating. | /self-employed, /first-time-buyer, /va-loans | **Refinance.** Its only offsettable block is one, and a single offset with nothing mirroring it reads as *misalignment*, not rhythm. Not every page has the structure. |
| 2026-08-22 | **8 — display face** | Bricolage Grotesque (OFL) on every display-scale h1; leading 1.25 → **1.00**. Two webfonts were downloading on every page and **rendered nowhere** (`font-serif`/`font-display` had zero uses) — dropped, so the family count fell 5 → 4. Better type for fewer bytes. | app-wide | **Licensing a face (~$200–600).** All three references use licensed or commissioned type; the free-but-characterful route was taken instead. Revisit only as a founder spend decision. |
| 2026-08-22 | **9 — illustrations replace stock** | Nine token-driven SVGs (5 scenes, 4 spot marks). Every stock photograph off the four persona pages. `SpotArt` gained a middle tier — uploaded file → token mark → registry glyph — which is why it finally has adopters. | 4 persona pages + Landing | **A directional claim in the refinance art.** Both offer cards are the same size with no figures: a picture implying a saving is an unsubstantiated advertising claim. **Borrowed service iconography** on the VA page — a cliché *and* a misrepresentation risk, since we do not act for the VA. **106 eager bytes** to pre-wire `Scene` for artwork that does not exist yet. |
| 2026-08-22 | **10 — hidden-tab reveal fix** | The primitives set `opacity: 0` and relied on JS to restore it. Measured live: two journey cards at **0.00**, two mid-ramp, *identical at 6s and 10s*. Cause: `document.hidden` throttles rAF, which framer-motion drives on. A hidden document now renders plainly. | Landing | — |

## Standing refusals — do not re-adopt when the idea returns reworded

- **Marquees** (auto-scrolling text) — WCAG 2.2.2, and hard to read by design.
- **A custom cursor** — meaningless on touch, costs more usability than it buys.
- **Making Homiquity look like Monzo.** Same sector, and a broker that looks like a bank is a
  trade-dress problem as well as a positioning one. Technique is portable; drawings and identity
  are not.
- **Copying "what Habito does" as one answer.** It is not one design system — their home page runs
  a 32px pill and 9 radii, their broker page a 2px corner and 5. Copying both imports an
  inconsistency.

## The rule this routine keeps relearning

**A raw count is never a finding.** Three times in one evening a true number produced a false
conclusion: "we have the most hairlines" (most were control affordances), "our buttons are 32%
taller" (those were tappable list rows; the real CTA is 4px off), "FAQ is the worst offender"
(eight of nine were dividers inside answer bodies). Ask what the elements **are** before concluding.

**And geometry and pictures catch different things.** The DOM said the offset blocks were moved by
224px and was right; the composition still failed, because the headings inside were centred. The
invisible journey cards survived several review rounds because every screenshot was a partial
viewport — a tall capture (1280×2600) put the whole page in one frame and the defect was instant.
