import { describe, it, expect } from "vitest";
import { STAGE_ORDER, getStageIndex } from "./stageOrder";

describe("getStageIndex", () => {
  it("maps every canonical status to its bucket", () => {
    expect(getStageIndex("draft")).toBe(0);
    expect(getStageIndex("doc_collection")).toBe(1);
    expect(getStageIndex("processing")).toBe(2);
    expect(getStageIndex("underwriting")).toBe(3);
    expect(getStageIndex("conditional")).toBe(4);
    expect(getStageIndex("closing")).toBe(5);
    expect(getStageIndex("funded")).toBe(6);
  });

  it("falls back to step 0 for off-ramp statuses instead of matching nothing", () => {
    expect(getStageIndex("denied")).toBe(0);
    expect(getStageIndex("withdrawn")).toBe(0);
    expect(getStageIndex("suspended")).toBe(0);
    expect(getStageIndex("expired")).toBe(0);
  });

  it("every stage's icon is defined", () => {
    for (const stage of STAGE_ORDER) {
      expect(stage.icon).toBeTruthy();
    }
  });
});
