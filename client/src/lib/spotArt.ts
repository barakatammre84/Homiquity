/**
 * Spot art — Tier 1 of the illustration system.
 *
 * A spot icon is a small BESPOKE DRAWING (36–48px) that sits beside a benefit or
 * feature row on a marketing surface. It is not a glyph, and it does not belong
 * in the 44-concept UI registry in `./icons.ts`: those are 16px Lucide glyphs
 * rendering inline in tables, buttons and form rows, where a painterly drawing
 * is illegible. Two tiers, two jobs — the reference measured for the brief runs
 * both side by side for exactly this reason.
 *
 * WHY A FALLBACK RATHER THAN A MANIFEST
 *
 * Every previous design standard here rotted the same way: it was defined, a
 * couple of surfaces adopted it, and the rest kept the old thing forever. So
 * this tier is built so that ZERO artwork is a working state. `SpotArt` renders
 * the registry's Lucide glyph until a drawing with the matching name appears,
 * then renders the drawing. Each uploaded file upgrades exactly one spot, with
 * no code change and no flag day.
 *
 * NAMING CONVENTION — the whole API:
 *
 *   attached_assets/spot/<concept>.svg     (preferred)
 *   attached_assets/spot/<concept>.png     (144x144, i.e. 4x for retina)
 *
 * where <concept> is any `IconName` from the registry. A file whose name is not
 * a registry concept is ignored rather than crashed on — an illustrator naming
 * a file `piggy-bank.svg` should not take the build down.
 *
 * `import.meta.glob({ eager: true })` resolves at BUILD time, so a missing file
 * is an absent key, never a runtime 404. That is what lets this ship before any
 * artwork exists.
 *
 * Specs and subjects: knowledge-base/design-identity/ILLUSTRATION_BRIEF.md
 */
import { Icons, type IconName } from "./icons";

const art = import.meta.glob<string>("../../../attached_assets/spot/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** `.../rate.svg` -> `rate` */
function conceptFromPath(path: string): string {
  return (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
}

function build(): Partial<Record<IconName, string>> {
  const out: Partial<Record<IconName, string>> = {};
  for (const [path, url] of Object.entries(art)) {
    const concept = conceptFromPath(path);
    // An unrecognised filename is ignored, not fatal. See the header note.
    if (!(concept in Icons)) continue;
    out[concept as IconName] = url;
  }
  return out;
}

/** Every concept that currently has bespoke artwork. Empty until art is uploaded. */
export const spotArtAssets = build();

/** The drawing for a concept, or undefined when the Lucide glyph is still in use. */
export function getSpotArt(name: IconName): string | undefined {
  return spotArtAssets[name];
}

/** Whether any bespoke spot art exists at all — useful for guarding a section. */
export const hasSpotArt = Object.keys(spotArtAssets).length > 0;
