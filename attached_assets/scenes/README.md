# Scene artwork — drop files here

Files placed here are picked up automatically by
`client/src/lib/sceneAssets.ts`. **No code change is needed to add one.**

## Naming

```
<id>_poster.png     the square still   (required)
<id>.webm           the muted loop     (optional)
```

`<id>` must be one of: `renting`, `self-employed`, `owner`, `moving-up`.

A poster with no `.webm` renders as a still picture — that is a valid outcome, not
a half-finished one. Add loops later without touching code.

## Specs

- **Any aspect ratio.** Nothing is cropped by default — the artwork keeps its own
  proportions. Landscape (e.g. 1024×576) is fine; so is square.
- **Size for 3× retina.** The tile renders ~300–400px wide, so supply ~1024px on
  the long edge. Bigger is wasted bytes, smaller goes soft.
- **The poster must be the loop's resting frame.** If it differs from frame one
  the video visibly jumps when it starts.
- **webm**, VP9, **muted**, seamless loop, 2–5s, **under 300 KB**.
- Motion small and looping: one or two elements move, the scene does not travel.

Full reasoning, and the measurements these come from, are in
[`knowledge-base/design-identity/ILLUSTRATION_BRIEF.md`](../../knowledge-base/design-identity/ILLUSTRATION_BRIEF.md).

## Checking your upload landed

```bash
pnpm dev          # then open the home page — the scene replaces the icon tile
```

An unrecognised filename is ignored rather than erroring, so if a scene does not
appear, check the id spelling against the list above first.
