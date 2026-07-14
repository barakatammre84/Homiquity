import { describe, expect, it } from "vitest";
import { configPatchSchema } from "../server/routes/autopilotAdmin";

describe("autopilot config PATCH validation", () => {
  it("accepts a partial toggle update", () => {
    const r = configPatchSchema.safeParse({ enabled: true });
    expect(r.success).toBe(true);
  });

  it("accepts an LO allowlist and a null allowlist", () => {
    expect(configPatchSchema.safeParse({ loanOfficerAllowlist: ["lo_1", "lo_2"] }).success).toBe(true);
    expect(configPatchSchema.safeParse({ loanOfficerAllowlist: null }).success).toBe(true);
  });

  it("rejects an empty update (nothing to change)", () => {
    expect(configPatchSchema.safeParse({}).success).toBe(false);
  });

  it("only allows the Fannie Mae guideline mode in v1", () => {
    expect(configPatchSchema.safeParse({ guidelineMode: "fannie_mae" }).success).toBe(true);
    // Freddie/Overlay/Custom are not claimed until authorities exist in-repo.
    expect(configPatchSchema.safeParse({ guidelineMode: "freddie_mac" }).success).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(configPatchSchema.safeParse({ enabled: "yes" }).success).toBe(false);
    expect(configPatchSchema.safeParse({ loanOfficerAllowlist: "lo_1" }).success).toBe(false);
  });
});
