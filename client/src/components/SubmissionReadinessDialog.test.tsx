import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubmissionReadinessDialog } from "./SubmissionReadinessDialog";
import { loanApplicationKeys } from "@/lib/queryClient";

// F-0818-09. `wholesale_lenders` has TWO identifiers: a uuid primary key (`id`)
// and the business key (`lenderId`, e.g. "uwm"). The server resolves a
// submission with `getWholesaleLenderByLenderId` — WHERE lender_id = $1 — so
// posting the uuid throws "Unknown wholesale lender <uuid>" before the
// counterparty gate is even reached. #417 moved the catalog from a hardcoded
// {id,name} array into the table across 29 files and never updated this
// component, so it kept reading `name` (a column that does not exist) and
// sending `id`. These tests pin the identifier contract in both directions:
// what we SEND must be the business key, and what we SHOW must be lenderName.

const apiRequestMock = vi.fn();
vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return { ...actual, apiRequest: (...args: unknown[]) => apiRequestMock(...args) };
});

const APP_ID = "app-1";

// Shaped as the route actually returns it: the whole row minus apiConfig
// (server/routes/underwriting/submissions.ts). Note `specialty` is nullable.
const lender = (over: Record<string, unknown> = {}) => ({
  id: "8f3a2b10-0000-4000-8000-000000000001",
  lenderId: "uwm",
  lenderName: "United Wholesale Mortgage",
  lenderCode: "UWM",
  approvalStatus: "approved",
  isDemo: false,
  specialty: "Non-QM and bank statement",
  ...over,
});

const readiness = (over: Record<string, unknown> = {}) => ({
  applicationId: APP_ID,
  readyToSubmitToLender: true,
  currentStage: "lenderPackage",
  stages: [],
  nextActions: [],
  ...over,
});

function renderDialog({
  lenders = [lender()],
  submissions = [] as Record<string, unknown>[],
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, enabled: false } },
  });
  client.setQueryData(loanApplicationKeys.submissionReadiness(APP_ID), readiness());
  client.setQueryData(["/api/wholesale-lenders"], lenders);
  client.setQueryData(loanApplicationKeys.lenderSubmissions(APP_ID), submissions);
  return render(
    <QueryClientProvider client={client}>
      <SubmissionReadinessDialog applicationId={APP_ID} borrowerName="WFQA Six" />
    </QueryClientProvider>,
  );
}

const openDialog = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByTestId(`submission-readiness-${APP_ID}`));
  return user;
};

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ json: async () => ({ id: "sub-1", lenderId: "uwm" }) });
});

describe("SubmissionReadinessDialog — the lender identifier contract (F-0818-09)", () => {
  it("shows the lender's NAME in an existing submission row, not the raw business key", async () => {
    // The helper looks a submission's lenderId up in the catalog. Matching it
    // against the uuid `id` never hits, so the row degrades to the slug.
    renderDialog({
      submissions: [
        {
          id: "sub-1",
          lenderId: "uwm",
          status: "in_underwriting",
          confirmationId: "CONF-8F3A2B",
          simulated: true,
          submittedAt: new Date("2026-08-18T12:00:00Z").toISOString(),
        },
      ],
    });
    await openDialog();
    const row = await screen.findByTestId("submission-row-sub-1");
    expect(row.textContent).toContain("United Wholesale Mortgage");
    expect(row.textContent).not.toContain("uwm");
  });

  it("renders each option by lenderName, and never emits the literal 'undefined'", async () => {
    renderDialog();
    const user = await openDialog();
    await user.click(screen.getByTestId("lender-select"));
    const option = await screen.findByTestId("lender-option-uwm");
    expect(option.textContent).toContain("United Wholesale Mortgage");
    expect(option.textContent).not.toContain("undefined");
  });

  it("submits the business lenderId, never the uuid primary key", async () => {
    renderDialog();
    const user = await openDialog();
    await user.click(screen.getByTestId("lender-select"));
    await user.click(await screen.findByTestId("lender-option-uwm"));
    await user.click(screen.getByTestId("submit-to-lender"));

    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [method, url, body] = apiRequestMock.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe(`/api/loan-applications/${APP_ID}/lender-submissions`);
    expect(body).toEqual({ lenderId: "uwm" });
    // The precise regression: a uuid here is what produced
    // "Unknown wholesale lender <uuid>" with an empty blockers array.
    expect((body as { lenderId: string }).lenderId).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("omits the separator when a lender has no specialty (demo rows have none)", async () => {
    renderDialog({ lenders: [lender({ specialty: null })] });
    const user = await openDialog();
    await user.click(screen.getByTestId("lender-select"));
    const option = await screen.findByTestId("lender-option-uwm");
    expect(option.textContent?.trim()).toBe("United Wholesale Mortgage");
  });
});
