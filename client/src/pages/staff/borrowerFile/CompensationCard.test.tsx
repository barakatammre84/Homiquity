import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompensationCard, COMPENSATION_MODEL_LABELS } from "./CompensationCard";
import { COMPENSATION_MODELS } from "@shared/compliance/loCompensation";

// Characterization tests for the staff compensation-election card — the
// client surface for PATCH /api/loan-applications/:id/compensation (audit
// F-1; flagged load-bearing-without-a-UI in UNCONSUMED_CAPABILITIES.md).
// Pins: the label map to the SHARED model vocabulary (the #247
// phantom-status bug class), the missing-election state as a blocking
// message that names the regulation, and the lock mirror of the server's
// 409 (`compensation_locked_after_le`) — the card must never offer an
// action the server would reject.

const APP_ID = "app-1";

function renderCard(props?: Partial<Parameters<typeof CompensationCard>[0]>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <CompensationCard
        applicationId={APP_ID}
        model={null}
        bps={null}
        leIssued={false}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("COMPENSATION_MODEL_LABELS", () => {
  it("covers exactly the shared vocabulary — no phantom models, none missing", () => {
    expect(Object.keys(COMPENSATION_MODEL_LABELS).sort()).toEqual(
      [...COMPENSATION_MODELS].sort(),
    );
  });
});

describe("CompensationCard", () => {
  it("renders no-election as a blocking state that names the regulation", () => {
    renderCard();
    const warning = screen.getByTestId("text-compensation-missing");
    expect(warning.textContent).toMatch(/Loan Estimate cannot be generated/);
    expect(warning.textContent).toMatch(/1026\.36\(d\)\(2\)/);
    expect(screen.getByTestId("button-elect-compensation").textContent).toMatch(
      /Elect compensation/,
    );
  });

  it("shows the elected model and rate", () => {
    renderCard({ model: "lender_paid", bps: 200 });
    expect(screen.getByTestId("badge-compensation-model").textContent).toBe("Lender-paid");
    expect(screen.getByTestId("text-compensation-bps").textContent).toBe("200 bps");
    expect(screen.queryByTestId("text-compensation-missing")).toBeNull();
  });

  it("mirrors the server's post-LE 409: elected + issued LE offers no edit", () => {
    renderCard({ model: "lender_paid", bps: 200, leIssued: true });
    expect(screen.getByTestId("text-compensation-locked").textContent).toMatch(
      /changed circumstance/,
    );
    expect(screen.queryByTestId("button-elect-compensation")).toBeNull();
  });

  it("still offers the FIRST election when the LE has issued but nothing is elected", () => {
    // The server only 409s a CHANGE after LE issuance; a first election is the
    // unblock, not a redisclosure event — the card must not over-lock.
    renderCard({ model: null, bps: null, leIssued: true });
    expect(screen.getByTestId("button-elect-compensation")).toBeTruthy();
    expect(screen.queryByTestId("text-compensation-locked")).toBeNull();
  });

  it("disables save until the bps draft is a whole number in [0, 1000]", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByTestId("button-elect-compensation"));

    const save = screen.getByTestId("button-save-compensation");
    expect(save).toHaveProperty("disabled", true); // empty draft

    const input = screen.getByTestId("input-compensation-bps");
    await user.type(input, "1500");
    expect(save).toHaveProperty("disabled", true); // over the route's max

    await user.clear(input);
    await user.type(input, "200");
    expect(save).toHaveProperty("disabled", false);
  });

  it("offers every shared model as an option", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByTestId("button-elect-compensation"));
    for (const model of COMPENSATION_MODELS) {
      expect(screen.getByTestId(`option-${model}`)).toBeTruthy();
    }
  });
});
