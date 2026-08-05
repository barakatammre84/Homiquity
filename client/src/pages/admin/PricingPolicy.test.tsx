import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PricingPolicy from "./PricingPolicy";

// The admin surface that makes audit F-17's two levers editable without a
// deploy: the platform fee schedule and the wholesale comp bands. These pin
// the properties that keep it honest rather than merely functional —
// baseline-vs-published is visible, a fee change cannot be anonymous, the
// origination rate is entered as a percentage (not a fraction), and the
// impact preview surfaces trimmed / not-originable outcomes.

const FEE_SCHEDULE_KEY = ["/api/admin/pricing-policy/fee-schedule"];
const LENDERS_KEY = ["/api/admin/pricing-policy/lenders"];

const schedule = (over: Record<string, unknown> = {}) => ({
  active: {
    applicationFee: 500,
    underwritingFee: 1500,
    taxServiceFee: 100,
    originationFeeRate: 0.01,
  },
  version: null,
  effectiveFrom: null,
  usingBaseline: true,
  baseline: {
    applicationFee: 500,
    underwritingFee: 1500,
    taxServiceFee: 100,
    originationFeeRate: 0.01,
  },
  preview: [
    {
      loanAmount: 150_000,
      feesCharged: 1456,
      standardTotal: 2100,
      trimmed: true,
      originable: true,
      maxElectableBps: 293,
    },
    {
      loanAmount: 400_000,
      feesCharged: 2100,
      standardTotal: 2100,
      trimmed: false,
      originable: true,
      maxElectableBps: 297,
    },
  ],
  history: [],
  ...over,
});

const lenders = {
  lenders: [
    {
      id: "lender-1",
      lenderName: "Summit Wholesale Lending",
      lenderCode: "SWL",
      status: "ACTIVE",
      brokerCompensation: {
        compensationType: "LENDER_PAID" as const,
        defaultBps: 200,
        minBps: 100,
        maxBps: 275,
      },
    },
  ],
};

function renderPage(feeData: unknown = schedule(), lenderData: unknown = lenders) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(FEE_SCHEDULE_KEY, feeData);
  client.setQueryData(LENDERS_KEY, lenderData);
  return render(
    <QueryClientProvider client={client}>
      <PricingPolicy />
    </QueryClientProvider>,
  );
}

describe("PricingPolicy — fee schedule", () => {
  it("says plainly when the built-in default is in force", () => {
    renderPage();
    expect(screen.getByTestId("badge-schedule-source").textContent).toMatch(/Built-in default/);
  });

  it("names the published version once one exists", () => {
    renderPage(schedule({ version: 3, usingBaseline: false, effectiveFrom: "2026-08-05" }));
    expect(screen.getByTestId("badge-schedule-source").textContent).toMatch(/Version 3/);
  });

  it("renders the active schedule", () => {
    renderPage();
    expect(screen.getByTestId("text-application-fee").textContent).toBe("$500");
    expect(screen.getByTestId("text-underwriting-fee").textContent).toBe("$1,500");
    expect(screen.getByTestId("text-tax-service-fee").textContent).toBe("$100");
  });

  it("shows the origination rate as a percentage, not a fraction", () => {
    // Entering 0.01 when you mean 1% is the slip this avoids; the field must
    // round-trip as a percentage in both directions.
    renderPage();
    expect(screen.getByTestId("text-origination-rate").textContent).toBe("1%");
  });

  it("edits from a percentage input", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-edit-schedule"));
    expect((screen.getByTestId("input-originationFeeRate") as HTMLInputElement).value).toBe("1");
  });

  it("will not publish a fee change without a reason", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-edit-schedule"));

    // A fee change is disclosed to every borrower priced after it — it is never
    // an anonymous edit.
    expect(screen.getByTestId("button-publish-schedule")).toHaveProperty("disabled", true);
    await user.type(screen.getByTestId("input-note"), "repriced after Summit renegotiation");
    expect(screen.getByTestId("button-publish-schedule")).toHaveProperty("disabled", false);
  });

  it("rejects an origination rate entered as a whole number of percent above the cap", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-edit-schedule"));
    await user.type(screen.getByTestId("input-note"), "typo check");

    const rate = screen.getByTestId("input-originationFeeRate");
    await user.clear(rate);
    await user.type(rate, "100"); // 100% — the classic fraction/percent slip
    expect(screen.getByTestId("button-publish-schedule")).toHaveProperty("disabled", true);
  });

  it("previews impact before publishing, not after", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-edit-schedule"));
    expect(screen.getByTestId("button-preview-schedule")).toBeTruthy();
  });
});

describe("PricingPolicy — impact preview", () => {
  it("marks a file whose fees were trimmed to fit the cap", () => {
    renderPage();
    const row = screen.getByTestId("row-preview-150000");
    expect(row.textContent).toMatch(/Trimmed from \$2,100/);
    expect(row.textContent).toMatch(/293 bps/);
  });

  it("marks a file charged the full schedule", () => {
    renderPage();
    expect(screen.getByTestId("row-preview-400000").textContent).toMatch(/Full schedule/);
  });

  it("flags a loan size no fee decision can rescue", () => {
    renderPage(
      schedule({
        preview: [
          {
            loanAmount: 120_000,
            feesCharged: 2100,
            standardTotal: 2100,
            trimmed: false,
            originable: false,
            maxElectableBps: null,
          },
        ],
      }),
    );
    const row = screen.getByTestId("row-preview-120000");
    expect(row.textContent).toMatch(/Not originable/);
    expect(row.textContent).toMatch(/—/);
  });
});

describe("PricingPolicy — wholesale comp bands", () => {
  it("shows each lender's band", () => {
    renderPage();
    expect(screen.getByTestId("text-default-bps-lender-1").textContent).toBe("200 bps");
    expect(screen.getByTestId("row-lender-lender-1").textContent).toMatch(/100–275 bps/);
  });

  it("opens an editor seeded from the current band", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId("button-edit-lender-lender-1"));
    expect((screen.getByTestId("input-default-bps-lender-1") as HTMLInputElement).value).toBe("200");
    expect((screen.getByTestId("input-min-bps-lender-1") as HTMLInputElement).value).toBe("100");
    expect((screen.getByTestId("input-max-bps-lender-1") as HTMLInputElement).value).toBe("275");
  });

  it("renders a lender with no band recorded without inventing one", () => {
    renderPage(schedule(), {
      lenders: [
        {
          id: "lender-2",
          lenderName: "Unsigned Lender",
          lenderCode: null,
          status: "TARGET",
          brokerCompensation: null,
        },
      ],
    });
    expect(screen.getByTestId("text-default-bps-lender-2").textContent).toBe("—");
  });
});
