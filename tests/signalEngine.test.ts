import { describe, it, expect } from "vitest";
import {
  planDocsReadySignals,
  SIGNAL_ACTIVE_STATUSES,
  STALL_WATCH_STATUSES,
} from "../server/services/signalEngine";
import { LOAN_APP_STATUSES, LOAN_APP_TERMINAL_STATUSES } from "../shared/schema";

describe("SIGNAL_ACTIVE_STATUSES (which applications the feed considers)", () => {
  it("contains only canonical statuses — no phantoms", () => {
    for (const s of SIGNAL_ACTIVE_STATUSES) {
      expect(LOAN_APP_STATUSES).toContain(s);
    }
  });

  it("pins the exact membership so scope changes are conscious", () => {
    // If a status is added to LOAN_APP_STATUSES, the derived gate inherits it
    // and this snapshot fails — forcing a decision on whether the new status
    // belongs in the staff signals feed instead of silently including it.
    expect([...SIGNAL_ACTIVE_STATUSES].sort()).toEqual(
      [
        "submitted",
        "analyzing",
        "under_review",
        "pre_approved",
        "doc_collection",
        "processing",
        "underwriting",
        "conditional",
      ].sort(),
    );
  });

  it("gates in under_review — files awaiting a human underwriting decision get signals", () => {
    expect(SIGNAL_ACTIVE_STATUSES).toContain("under_review");
  });

  it("partitions the canonical vocabulary: every status is signal-active or a documented exclusion", () => {
    const EXCLUDED: readonly string[] = [
      ...LOAN_APP_TERMINAL_STATUSES,
      "draft",
      "clear_to_close",
      "closing",
      "suspended",
    ];
    for (const s of LOAN_APP_STATUSES) {
      const active = SIGNAL_ACTIVE_STATUSES.includes(s);
      const excluded = EXCLUDED.includes(s);
      expect(active !== excluded, `"${s}" must be exactly one of active/excluded`).toBe(true);
    }
  });
});

describe("STALL_WATCH_STATUSES (the stalled-signal scope)", () => {
  it("is a subset of the feed gate — a stall can only fire on a gated-in application", () => {
    for (const s of STALL_WATCH_STATUSES) {
      expect(SIGNAL_ACTIVE_STATUSES).toContain(s);
    }
  });

  it("watches under_review — a flag-less file awaiting a decision must still surface", () => {
    expect(STALL_WATCH_STATUSES).toContain("under_review");
  });
});

describe("planDocsReadySignals", () => {
  it("groups documents per application with a count and up to three file names", () => {
    const groups = planDocsReadySignals([
      { applicationId: "app-1", fileName: "w2.pdf" },
      { applicationId: "app-1", fileName: "paystub.pdf" },
      { applicationId: "app-1", fileName: "bank.pdf" },
      { applicationId: "app-1", fileName: "lease.pdf" },
      { applicationId: "app-2", fileName: "tax.pdf" },
    ]);
    expect(groups).toHaveLength(2);
    const app1 = groups.find((g) => g.applicationId === "app-1")!;
    expect(app1.count).toBe(4);
    expect(app1.fileNames).toEqual(["w2.pdf", "paystub.pdf", "bank.pdf"]); // capped at 3
    const app2 = groups.find((g) => g.applicationId === "app-2")!;
    expect(app2.count).toBe(1);
    expect(app2.fileNames).toEqual(["tax.pdf"]);
  });

  it("skips rows without an applicationId (unsolicited uploads have no file to open)", () => {
    expect(planDocsReadySignals([{ applicationId: null, fileName: "orphan.pdf" }])).toEqual([]);
  });

  it("returns an empty list for no input", () => {
    expect(planDocsReadySignals([])).toEqual([]);
  });
});
