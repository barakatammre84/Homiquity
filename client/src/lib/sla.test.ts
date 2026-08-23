import { describe, it, expect } from "vitest";
import {
  type SlaStatus,
  SLA_STATUS_COLORS,
  SLA_DOT_COLORS,
  SLA_STATUS_LABELS,
  SLA_SORT_ORDER,
} from "./sla";

// Characterisation test: pins what client/src/lib/sla.ts does TODAY.
//
// Four maps keyed by the same three-value union feed three different staff
// surfaces, and nothing else checks that they stay in step:
//   • SLA_STATUS_COLORS / SLA_DOT_COLORS -> MyQueueTab.tsx:80,96 interpolate the
//     value straight into a className, so a missing key renders the string
//     "undefined" as a class — silent, and the dot simply disappears.
//   • SLA_DOT_COLORS + SLA_STATUS_LABELS -> SlaStatusBadge.tsx renders the dot
//     colour as the badge BACKGROUND with white type on it, so that map's values
//     have to be bg-* classes, not text-*.
//   • SLA_SORT_ORDER -> StaffDashboard.tsx:131-133 sorts the staff queue by it,
//     with `?? 2` as the fallback. A missing key therefore does not throw; it
//     sorts a breached task last, which is the exact inversion of the queue's
//     purpose.
// The three status strings themselves are produced server-side by
// taskEngine.computeSlaStatus (server/services/taskEngine.ts:157-183) and arrive
// over the wire, so the union is a real wire vocabulary, not just a local type.

// The three statuses the server can emit. `satisfies` makes an added union
// member a compile error here rather than an untested key.
const ALL_STATUSES = ["green", "amber", "red"] as const satisfies readonly SlaStatus[];

const MAPS = {
  SLA_STATUS_COLORS,
  SLA_DOT_COLORS,
  SLA_STATUS_LABELS,
  SLA_SORT_ORDER,
} as const;

// Mirrors scripts/design-token-guard.cjs's rawColorOccurrences matcher (baseline
// 0 — a hard target). Assembled from parts at runtime on purpose: the guard
// scans every .ts file under client/src, including this one, so spelling a raw
// palette utility out as a literal — even inside a comment — would itself be the
// regression it is here to catch.
const PROP = [
  "bg", "text", "border", "ring", "fill", "stroke", "from", "to", "via",
  "divide", "outline", "decoration", "placeholder", "caret", "accent", "shadow",
].join("|");
const COLOR = [
  "gray", "slate", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo",
  "violet", "purple", "fuchsia", "pink", "rose",
].join("|");
const SHADE = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].join("|");
const RAW_PALETTE = new RegExp(
  `(?<![a-zA-Z0-9-])(?:${PROP})-(?:${COLOR})-(?:${SHADE})(?![a-zA-Z0-9])`,
);

// The semantic families the Royal Blue Emerald system gives these three states.
const SEMANTIC_TOKEN = /^(?:text|bg)-(?:success|warning|destructive)(?:-[a-z]+)*$/;

describe("SLA maps cover every status", () => {
  it.each(Object.keys(MAPS) as (keyof typeof MAPS)[])(
    "%s has an entry for every SlaStatus and no others",
    (name) => {
      const map = MAPS[name] as Record<string, string | number>;
      for (const status of ALL_STATUSES) {
        expect(Object.prototype.hasOwnProperty.call(map, status)).toBe(true);
        expect(map[status]).toBeDefined();
      }
      expect(Object.keys(map).sort()).toEqual([...ALL_STATUSES].sort());
    },
  );

  it("never yields an undefined class for a status off the wire", () => {
    for (const status of ALL_STATUSES) {
      // The interpolation MyQueueTab does; "undefined" is the failure shape.
      expect(`${SLA_STATUS_COLORS[status]}`).not.toContain("undefined");
      expect(`${SLA_DOT_COLORS[status]}`).not.toContain("undefined");
    }
  });
});

describe("colour and dot classes are design tokens", () => {
  it.each(ALL_STATUSES)("SLA_STATUS_COLORS.%s is a semantic text token", (status) => {
    const cls = SLA_STATUS_COLORS[status];
    expect(cls).not.toMatch(RAW_PALETTE);
    expect(cls).toMatch(SEMANTIC_TOKEN);
    expect(cls.startsWith("text-")).toBe(true);
  });

  it.each(ALL_STATUSES)("SLA_DOT_COLORS.%s is a semantic background token", (status) => {
    const cls = SLA_DOT_COLORS[status];
    expect(cls).not.toMatch(RAW_PALETTE);
    expect(cls).toMatch(SEMANTIC_TOKEN);
    // SlaStatusBadge paints this as the badge's fill, so bg-* is load-bearing.
    expect(cls.startsWith("bg-")).toBe(true);
  });

  it("would actually catch a raw palette utility", () => {
    // Without this, a regex that matched nothing would let the two assertions
    // above pass on any string at all. The counterexample is assembled at
    // runtime for the same reason RAW_PALETTE is.
    const rawExample = ["bg", "red", "500"].join("-");
    expect(rawExample).toMatch(RAW_PALETTE);
    expect(rawExample).not.toMatch(SEMANTIC_TOKEN);
  });

  it("uses a distinct token per status in both maps", () => {
    expect(new Set(Object.values(SLA_STATUS_COLORS)).size).toBe(ALL_STATUSES.length);
    expect(new Set(Object.values(SLA_DOT_COLORS)).size).toBe(ALL_STATUSES.length);
  });
});

describe("SLA_SORT_ORDER puts the worst first", () => {
  it("orders red before amber before green", () => {
    expect(SLA_SORT_ORDER.red).toBeLessThan(SLA_SORT_ORDER.amber);
    expect(SLA_SORT_ORDER.amber).toBeLessThan(SLA_SORT_ORDER.green);
  });

  it("sorts a staff queue the way StaffDashboard does", () => {
    // The comparator at StaffDashboard.tsx:130-136, including its `?? 2`
    // fallback and the timeRemaining tie-break.
    const queue = [
      { id: "g", slaStatus: "green" as SlaStatus, timeRemaining: 10 },
      { id: "r", slaStatus: "red" as SlaStatus, timeRemaining: 0 },
      { id: "a2", slaStatus: "amber" as SlaStatus, timeRemaining: 9 },
      { id: "a1", slaStatus: "amber" as SlaStatus, timeRemaining: 2 },
    ];
    const sorted = [...queue].sort((a, b) => {
      const aOrder = SLA_SORT_ORDER[a.slaStatus] ?? 2;
      const bOrder = SLA_SORT_ORDER[b.slaStatus] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.timeRemaining ?? Infinity) - (b.timeRemaining ?? Infinity);
    });
    expect(sorted.map((t) => t.id)).toEqual(["r", "a1", "a2", "g"]);
  });

  it("gives green the same rank as the missing-key fallback", () => {
    // `?? 2` is only harmless while green is itself 2 — otherwise an unknown
    // status would outrank a healthy one.
    expect(SLA_SORT_ORDER.green).toBe(2);
  });
});

describe("SLA_STATUS_LABELS are the borrower-facing strings", () => {
  it("reads On Track / At Risk / Breached", () => {
    expect(SLA_STATUS_LABELS).toEqual({
      green: "On Track",
      amber: "At Risk",
      red: "Breached",
    });
  });
});
