/**
 * Scene assets — auto-discovered, so uploading art needs no code change.
 *
 * Drop files into `attached_assets/scenes/` following the naming convention and
 * they appear on the site. Nothing here has to be edited, no import added, no
 * manifest updated. That is deliberate: `lifestyleImages.ts` is a hand-maintained
 * list and every photo swap needs a code edit, which is the kind of friction that
 * ends with assets sitting in a folder nobody wired up.
 *
 * NAMING CONVENTION — this is the whole API:
 *
 *   attached_assets/scenes/<id>_poster.png     the still  (required)
 *   attached_assets/scenes/<id>.webm           the loop   (optional)
 *
 * where <id> is one of the SCENE_IDS below. A poster with no webm renders as a
 * still picture, which is a perfectly good outcome — the loop is an enhancement.
 *
 * `import.meta.glob` with `eager: true` is resolved by Vite at BUILD time, so a
 * missing file is simply an absent key rather than a runtime 404 or a broken
 * import. That is why this can ship before any asset exists.
 *
 * Specs, and the reason for each, live in
 * knowledge-base/design-identity/ILLUSTRATION_BRIEF.md.
 */

/** The four journey doors on the home page. Ids match `JOURNEYS` in Landing.tsx. */
export const SCENE_IDS = ["renting", "self-employed", "owner", "moving-up"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneAsset {
  /** Square still. Always rendered — Scene layers the loop over it. */
  poster: string;
  /** Muted loop, if one has been supplied for this id. */
  video?: string;
  /** Describes the illustration for anyone who cannot see it. */
  alt: string;
}

const posters = import.meta.glob<string>("../../../attached_assets/scenes/*_poster.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
});

const videos = import.meta.glob<string>("../../../attached_assets/scenes/*.webm", {
  eager: true,
  query: "?url",
  import: "default",
});

/** `.../renting_poster.png` -> `renting` */
function idFromPath(path: string, suffix: string): string {
  const file = path.split("/").pop() ?? "";
  return file.replace(suffix, "").replace(/\.[^.]+$/, "");
}

/**
 * Alt text per scene. Kept here rather than derived from the filename because a
 * filename is not a description, and an illustration a sighted visitor enjoys is
 * otherwise nothing at all to a screen-reader user.
 *
 * Fair Housing note: these describe the artwork. If a scene depicts people, the
 * same representation rule that governs `lifestyleImages.ts` applies to the
 * commission — see the brief.
 */
const ALT: Record<SceneId, string> = {
  renting: "An illustrated rented flat with a set of keys resting on the counter",
  "self-employed": "An illustrated desk with a tax return, a laptop and a coffee",
  owner: "An illustrated house with a second, smaller house beside it",
  "moving-up": "An illustrated larger home with a moving box on the doorstep",
};

function build(): Partial<Record<SceneId, SceneAsset>> {
  const out: Partial<Record<SceneId, SceneAsset>> = {};
  for (const [path, url] of Object.entries(posters)) {
    const id = idFromPath(path, "_poster") as SceneId;
    if (!SCENE_IDS.includes(id)) continue; // an unrecognised filename is ignored, not crashed on
    const video = Object.entries(videos).find(([vp]) => idFromPath(vp, "") === id)?.[1];
    out[id] = { poster: url, video, alt: ALT[id] };
  }
  return out;
}

/**
 * Every scene that currently has artwork. **Empty until assets are uploaded** —
 * callers must handle a missing id rather than assuming one is present.
 */
export const sceneAssets = build();

/** The scene for a journey door, or undefined if its artwork has not arrived yet. */
export function getScene(id: SceneId): SceneAsset | undefined {
  return sceneAssets[id];
}
