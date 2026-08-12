import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScenarioSimulatorDialog } from "./ScenarioSimulatorDialog";
import { apiRequest } from "@/lib/queryClient";

// Characterization tests (refactor-radar RR-004), written BEFORE extracting the
// dialog's request/prefill logic into scenarioSimulator/scenarioRequest.ts.
// They pin the CURRENT behavior — the exact POST /api/scenarios/simulate payload
// for given form inputs, the licensed-data prefill derivation, and the rendered
// result strings — so the extraction is provably behavior-preserving. If these
// assertions ever need editing during a refactor, the refactor changed behavior.

vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn() }));

// Radix Dialog/Select drive pointer-capture + scroll APIs happy-dom doesn't ship.
beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const APP_ID = "app-1";

// Canned licensed-property payloads for the address-first intake, served by the
// query client's default queryFn (the component's queries carry no queryFn).
const SUGGESTIONS = [
  {
    id: "addr:prop-123",
    type: "address",
    label: "123 Main St, Naperville, IL 60540",
    city: "Naperville",
    stateCode: "IL",
  },
];

const PROPERTY_DETAIL = {
  property_id: "prop-123",
  price: 512345.67,
  address: "123 Main St",
  city: "Naperville",
  stateCode: "IL",
  zipcode: "60540",
  propertyType: "Condominium",
  taxHistory: [{ year: 2025, tax: 8123.45 }],
  estimates: {
    current_values: [
      { estimate: 498765.43, isbest_homevalue: false },
      { estimate: 501234.56, isBestHomeValue: true },
    ],
  },
  hoa: null,
};

const OK_RESPONSE = {
  runId: "run-1",
  serverMs: 42,
  status: "OK",
  simulated: true,
  missingItems: [],
  income: {
    primaryMonthlyQualifyingIncome: 8750,
    incomeBasis: "urla_line_items",
    requiresManualReview: false,
  },
  monthlyDebts: 1234.56,
  offers: [
    {
      lenderId: "L1",
      productId: "P1",
      productCode: "CONV30",
      productName: "Conventional 30-Year Fixed",
      productType: "CONVENTIONAL",
      loanTerm: 360,
      lockTerm: 30,
      adjustedRate: 6.5,
      payment: { principalAndInterest: 2101.01, mortgageInsurance: 0, escrow: 244.66, totalPiti: 2345.67 },
      apr: 6.612,
      costs: { totalClosingCosts: 18000, cashToClose: 12345, pointsAndFeesDollars: 4200 },
      qualification: { decision: "APPROVED", dti: 43.2, ltv: 80, reasons: [] },
    },
    {
      lenderId: "L2",
      productId: "P2",
      productCode: "FHA30",
      productName: "FHA 30-Year Fixed",
      productType: "FHA",
      loanTerm: 360,
      lockTerm: 30,
      adjustedRate: 6.125,
      payment: { principalAndInterest: 1990.55, mortgageInsurance: 210.4, escrow: 244.66, totalPiti: 2445.61 },
      apr: 6.988,
      costs: { totalClosingCosts: 21000, cashToClose: 15000, pointsAndFeesDollars: 6100 },
      qualification: { decision: "REJECTED", dti: null, ltv: 96.5, reasons: ["DTI exceeds product ceiling"] },
    },
  ],
  excludedProducts: ["JUMBO-X"],
  antiSteering: {
    citation: "12 CFR §1026.36(e)(3)",
    creditorsQuoted: 2,
    options: [{ key: "lowest_rate", lenderId: "L1", productId: "P1" }],
  },
};

function stubQueryFn({ queryKey }: { queryKey: readonly unknown[] }) {
  const key = String(queryKey[0]);
  if (key.startsWith("/api/properties/auto-complete")) return Promise.resolve(SUGGESTIONS);
  if (key.startsWith("/api/properties/detail-live")) return Promise.resolve(PROPERTY_DETAIL);
  return Promise.reject(new Error(`unstubbed query: ${key}`));
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn: stubQueryFn },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ScenarioSimulatorDialog applicationId={APP_ID} borrowerName="Jordan Case" />
    </QueryClientProvider>,
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId(`open-simulator-${APP_ID}`));
  await screen.findByTestId("scenario-simulator-dialog");
}

async function pickOption(user: ReturnType<typeof userEvent.setup>, triggerTestId: string, optionName: string) {
  await user.click(screen.getByTestId(triggerTestId));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: optionName }));
}

function lastScenarioCall() {
  const calls = vi.mocked(apiRequest).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const [method, url, body] = calls[calls.length - 1];
  expect(method).toBe("POST");
  expect(url).toBe("/api/scenarios/simulate");
  return body as { applicationId: string; scenario: Record<string, unknown> };
}

beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockResolvedValue({ json: async () => OK_RESPONSE } as Response);
});

describe("ScenarioSimulatorDialog — request assembly", () => {
  it("sends exactly the default scenario (percent unit, no optional fields)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByTestId("scenario-price-input"), "500000");
    await user.click(screen.getByTestId("scenario-run-button"));
    await screen.findByTestId("scenario-results");

    expect(lastScenarioCall()).toEqual({
      applicationId: APP_ID,
      scenario: {
        purchasePrice: 500000,
        downPaymentPercent: 20,
        occupancyType: "primary_residence",
        propertyType: "single_family",
        lockTermDays: 30,
      },
    });
  });

  it("sends the dollar unit, product filter, multi-family units, and optional fields when set", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByTestId("scenario-price-input"), "450000");
    await user.clear(screen.getByTestId("scenario-dp-input"));
    await user.type(screen.getByTestId("scenario-dp-input"), "50000");
    await pickOption(user, "scenario-dp-unit", "$");
    await pickOption(user, "scenario-product-select", "FHA");
    await pickOption(user, "scenario-property-type-select", "Multi-family (2–4)");
    await pickOption(user, "scenario-units-select", "3 units");
    await user.type(screen.getByTestId("scenario-fico-input"), "700");
    await pickOption(user, "scenario-lock-select", "45 days");
    await user.type(screen.getByTestId("scenario-taxes-input"), "4800");
    await user.click(screen.getByTestId("scenario-run-button"));
    await screen.findByTestId("scenario-results");

    expect(lastScenarioCall()).toEqual({
      applicationId: APP_ID,
      scenario: {
        purchasePrice: 450000,
        downPaymentAmount: 50000,
        occupancyType: "primary_residence",
        propertyType: "multi_family",
        lockTermDays: 45,
        productTypes: ["FHA"],
        numberOfUnits: 3,
        ficoWhatIf: 700,
        annualPropertyTaxes: 4800,
      },
    });
  });

  it("prefills from licensed property data and sends the address context", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByTestId("scenario-address-input"), "123 Main");
    await user.click(await screen.findByTestId("scenario-suggestion-addr:prop-123", undefined, { timeout: 4000 }));
    await screen.findByTestId("scenario-prefill-note", undefined, { timeout: 4000 });

    // Prefill derivation pinned: price rounds, best-flagged AVM value wins
    // (both casings accepted), latest tax rounds, "Condominium" maps to condo.
    expect(screen.getByTestId("scenario-price-input")).toHaveProperty("value", "512346");
    expect(screen.getByTestId("scenario-taxes-input")).toHaveProperty("value", "8123");

    await user.click(screen.getByTestId("scenario-run-button"));
    await screen.findByTestId("scenario-results");

    expect(lastScenarioCall()).toEqual({
      applicationId: APP_ID,
      scenario: {
        purchasePrice: 512346,
        downPaymentPercent: 20,
        occupancyType: "primary_residence",
        propertyType: "condo",
        lockTermDays: 30,
        annualPropertyTaxes: 8123,
        propertyValue: 501235,
        addressContext: {
          line: "123 Main St",
          city: "Naperville",
          stateCode: "IL",
          zipcode: "60540",
          propertyId: "prop-123",
          source: "realty-us",
          observedPropertyType: "Condominium",
        },
        propertyState: "IL",
      },
    });
  });
});

describe("ScenarioSimulatorDialog — result rendering", () => {
  it("renders the canned OK response faithfully (rails, strip, cards, table)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await user.type(screen.getByTestId("scenario-price-input"), "500000");
    await user.click(screen.getByTestId("scenario-run-button"));
    await screen.findByTestId("scenario-results");

    expect(screen.getByTestId("scenario-simulated-banner").textContent).toContain("Simulated rate data");

    const strip = screen.getByTestId("scenario-income-strip").textContent ?? "";
    expect(strip).toContain("$8,750.00/mo");
    expect(strip).toContain("(URLA line items)");
    expect(strip).toContain("$1,234.56");
    expect(strip).toContain("Engine time 42ms");

    const card = screen.getByTestId("anti-steering-lowest_rate").textContent ?? "";
    expect(card).toContain("Lowest rate");
    expect(card).toContain("Conventional 30-Year Fixed");
    expect(card).toContain("6.500%");
    expect(card).toContain("APR 6.612%");
    expect(card).toContain("$2,345.67/mo");
    expect(card).toContain("$12,345 to close");
    expect(card).toContain("Qualifies");

    const approvedRow = screen.getByTestId("offer-row-CONV30").textContent ?? "";
    expect(approvedRow).toContain("(CONVENTIONAL, 30y)");
    expect(approvedRow).toContain("6.500%");
    expect(approvedRow).toContain("6.612%");
    expect(approvedRow).toContain("$2,101.01");
    expect(approvedRow).toContain("$2,345.67");
    expect(approvedRow).toContain("$12,345");
    expect(approvedRow).toContain("43.2%");
    expect(approvedRow).toContain("Qualifies");

    const rejectedRow = screen.getByTestId("offer-row-FHA30").textContent ?? "";
    expect(rejectedRow).toContain("Does not qualify");
    expect(rejectedRow).toContain("—");

    expect((screen.getByTestId("scenario-reasons").textContent ?? "")).toContain("DTI exceeds product ceiling");
    expect((screen.getByTestId("scenario-excluded").textContent ?? "")).toContain("JUMBO-X");
  });

  it("renders the no-income gap state with its missing items", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      json: async () => ({
        runId: null,
        serverMs: 5,
        status: "NEEDS_INCOME_EVALUATION",
        simulated: true,
        missingItems: ["Persisted income evaluation"],
        income: null,
        monthlyDebts: null,
        offers: [],
        excludedProducts: [],
        antiSteering: null,
      }),
    } as Response);

    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await user.type(screen.getByTestId("scenario-price-input"), "500000");
    await user.click(screen.getByTestId("scenario-run-button"));

    const gap = await screen.findByTestId("scenario-gap-card");
    expect(gap.textContent).toContain("No persisted income evaluation");
    expect(gap.textContent).toContain("Persisted income evaluation");
  });
});
