import { describe, it, expect } from "vitest";
import { planDocsReadySignals } from "../server/services/signalEngine";

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
