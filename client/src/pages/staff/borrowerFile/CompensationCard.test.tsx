import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompensationCard, COMPENSATION_MODEL_LABELS } from "./CompensationCard";
import { COMPENSATION_MODELS } from "@shared/compliance/loCompensation";
import { loanApplicationKeys } from "@/lib/queryClient";

// Characterization tests for the staff compensation-election card — the
// client surface for PATCH /api/loan-applications/:id/compensation (audit
// F-1; flagged load-bearing-without-a-UI in UNCONSUMED_CAPABILITIES.md).
// Pins: the label map to the SHARED model vocabulary (the #247
// phantom-status bug class), the missing-election state as a blocking
// message that names the regulation, and the lock mirror of the server's
// 409 (`compensation_locked_after_le`) — the card must never offer an
// action the server would reject.

const APP_ID = "app-1";

function renderCard(
  props?: Partial<Parameters<typeof CompensationCard>[0]>,
  qm?: unknown,
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  if (qm !== undefined) {
    client.setQueryData(loanApplicationKeys.compensationQm(APP_ID), qm);
  }
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

// ---------------------------------------------------------------------------
// Audit F-18 — the QM ceiling is surfaced at the election, the last moment it
// can still be acted on. The card mirrors the server's 422 the same way it
// already mirrors the post-LE 409: never offer a rate the election refuses.
// ---------------------------------------------------------------------------

const qmPicture = (over: Record<string, unknown> = {}) => ({
  evaluated: true,
  loanAmount: 400_000,
  maxElectableBps: { lender_paid: 297, borrower_paid: 400 },
  election: null,
  ...over,
});

describe("CompensationCard — QM headroom (F-18)", () => {
  it("shows the headroom on an elected file", () => {
    renderCard(
      { model: "lender_paid", bps: 200 },
      qmPicture({
        election: {
          verdict: "not_cleared",
          floorAmount: 10_000,
          maxAllowableAmount: 11_937,
          headroomAmount: 1_937,
          tierDescription: "3% of the Regulation Z Total Loan Amount",
        },
      }),
    );
    const headroom = screen.getByTestId("text-qm-headroom");
    expect(headroom.textContent).toMatch(/\$1,937/);
    // The floor is a lower bound and must never read as a cleared figure.
    expect(headroom.textContent).toMatch(/true figure is higher/);
  });

  it("renders no headroom row when the picture has not loaded", () => {
    renderCard({ model: "lender_paid", bps: 200 });
    expect(screen.queryByTestId("text-qm-headroom")).toBeNull();
  });

  it("shows the ceiling for the selected model in the dialog", async () => {
    const user = userEvent.setup();
    renderCard({}, qmPicture());
    await user.click(screen.getByTestId("button-elect-compensation"));
    expect(screen.getByTestId("text-qm-ceiling").textContent).toMatch(/297 bps/);
  });

  it("moves the ceiling when the model toggles — the models price differently", async () => {
    const user = userEvent.setup();
    renderCard({}, qmPicture());
    await user.click(screen.getByTestId("button-elect-compensation"));
    await user.click(screen.getByTestId("option-borrower_paid"));
    expect(screen.getByTestId("text-qm-ceiling").textContent).toMatch(/400 bps/);
  });

  it("mirrors the server's 422: a rate above the ceiling cannot be saved", async () => {
    const user = userEvent.setup();
    renderCard({}, qmPicture());
    await user.click(screen.getByTestId("button-elect-compensation"));

    const input = screen.getByTestId("input-compensation-bps");
    const save = screen.getByTestId("button-save-compensation");

    await user.type(input, "298"); // one over the 297 ceiling
    expect(save).toHaveProperty("disabled", true);
    expect(screen.getByTestId("text-qm-over-ceiling").textContent).toMatch(/exceeds the 297 bps/);

    await user.clear(input);
    await user.type(input, "297"); // exactly at it
    expect(save).toHaveProperty("disabled", false);
    expect(screen.queryByTestId("text-qm-over-ceiling")).toBeNull();
  });

  it("says so plainly when NO rate clears the cap (audit F-17)", async () => {
    const user = userEvent.setup();
    renderCard({}, qmPicture({ loanAmount: 150_000, maxElectableBps: { lender_paid: null, borrower_paid: null } }));
    await user.click(screen.getByTestId("button-elect-compensation"));

    expect(screen.getByTestId("alert-qm-no-viable-rate").textContent).toMatch(
      /fee schedule or the loan amount has to change/,
    );
    // No ceiling to hunt for, and nothing electable.
    expect(screen.queryByTestId("text-qm-ceiling")).toBeNull();
    await user.type(screen.getByTestId("input-compensation-bps"), "0");
    expect(screen.getByTestId("button-save-compensation")).toHaveProperty("disabled", true);
  });

  it("does not constrain the draft when the file has no loan amount yet", async () => {
    const user = userEvent.setup();
    renderCard({}, { evaluated: false, loanAmount: null, maxElectableBps: null, election: null });
    await user.click(screen.getByTestId("button-elect-compensation"));

    await user.type(screen.getByTestId("input-compensation-bps"), "250");
    expect(screen.getByTestId("button-save-compensation")).toHaveProperty("disabled", false);
    expect(screen.queryByTestId("text-qm-ceiling")).toBeNull();
    expect(screen.queryByTestId("alert-qm-no-viable-rate")).toBeNull();
  });
});
