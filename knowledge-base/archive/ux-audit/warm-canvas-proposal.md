> **⛔ ARCHIVED 2026-08-06 — the UX daily-loop routine is dead (last run 2026-07-16). Do not act on this document.** It lived under `logs/`, which the [KB index](../README.md) declares immutable ("never rewritten"), while its own README described a routine that rewrote these artifacts daily — a contradiction resolved by archiving. The successor register is [feature-review/FINDINGS.md](../../feature-review/FINDINGS.md), which this directory's own exec-summary already named. Design *values* are canonical in [handbook/design/DESIGN_SYSTEM.md](../../handbook/design/DESIGN_SYSTEM.md). Retained for history only.

# Proposal: Warm-neutral canvas variant ("Warm Paper")

**Status: PROPOSED — not applied.** This is a decision memo, not shipped work.

> **History (2026-07-04):** the patch was briefly applied (commit 52e4ccf) after a
> series of warm-design briefs were pasted into a session, then reverted the same
> day when it emerged the pastes were accidental (retracted in a parallel session;
> see the design-system memory). Net effect on the codebase: none — Obsidian
> Indigo's cool neutrals stand. If a warm canvas is ever wanted for real,
> `git cherry-pick 52e4ccf` restores the full verified patch (WCAG-checked,
> var-driven skeleton included).

## The conflict this memo exists to surface

A warm re-theme was requested (2026-07-04) via a "warm & trusting fintech" design prompt:
replace cool blue-gray backgrounds with warm sand/stone neutrals. But Homiquity already
made the opposite call: **Obsidian Indigo** (chosen 2026-07-02) explicitly *replaced* a
briefly-applied warm Better.com-style theme ("Calm Pine") because the goal was
"absolute trust and institutional authority… high-performance financial utility, not
consumer neobank." The design-token guard now hard-fails any raw palette class, and
`design_guidelines.md` declares code the source of truth.

Warmth-as-copy and warmth-as-behavior (conversational microcopy, reassurance at PII
fields, human error states, generous spacing) were applied to the URLA wizard without
touching the palette — those two kinds of warmth are separable, and the psychological
research mostly supports copy/behavior as the trust lever, not beige.

## If the warm canvas is wanted anyway: exact change

Only three tokens move; the ramp, primary actions, sidebar, and all semantic status
colors stay Obsidian Indigo. This keeps "Steel Blue identity + warm paper canvas."

```json
{
  "name": "warm-paper-canvas",
  "base": "Obsidian Indigo (unchanged: primary #050B14, sidebar #0C1625, ramp precision.50-950)",
  "changes": {
    "--background": { "from": "Paper Ice #F2F6FC (hsl 216 63% 97%)", "to": "Warm Paper #F9F7F4 (hsl 36 30% 97%)" },
    "--border":     { "from": "Frost #D0DDF0 (hairline)",            "to": "Warm Stone #E5E1DA (hsl 38 17% 88%)" },
    "--muted":      { "from": "cool muted",                          "to": "hsl 38 20% 94%" }
  },
  "unchanged": ["--primary", "--card (stays white)", "--success/warning/info/destructive (+subtle)", "sidebar Deep Ink", "chart-1..5"],
  "wcag": "foreground-on-background contrast is unaffected (L stays 97%); re-run the contrast checks for muted-foreground on the new --muted before shipping"
}
```

Patch site: `client/src/index.css` (`:root` block), three lines. Reversible in one commit.

## Visual evidence

A live A/B was captured in the 2026-07-04 session on the new URLA wizard (mobile, 375px):
Paper Ice vs Warm Paper via runtime CSS-var override. Difference is perceptible but
subtle at 97% lightness — the "warmth" a borrower actually notices comes from the copy
and pacing, not the 36° hue shift.

## Recommendation

Keep Obsidian Indigo. The 07-02 decision was deliberate and recent, the institutional
register is the brand, and the URLA work demonstrates warmth is achievable inside the
existing system. If warm neutrals are still wanted after seeing the shipped wizard,
apply the 3-token patch above as its own commit so it can be reverted independently.
