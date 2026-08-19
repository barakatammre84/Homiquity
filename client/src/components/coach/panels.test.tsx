import { describe, it, expect } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { DocumentChecklistPanel, StatusPanel } from "./panels";
import type { ChecklistItemView } from "@/lib/documentChecklist";
import type { LoanStatusView } from "./types";

/**
 * These panels are where the assistant's silent-success bug actually reached
 * the borrower.
 *
 * The checklist used to be authored by the model through set_document_checklist:
 * it invented a `docType` matching no loan_condition, this component rendered it
 * authoritatively next to an Upload button, the borrower uploaded — and the item
 * never cleared, because the real checklist is derived from loan_conditions
 * elsewhere. The UI said the operation happened; the file said it did not.
 *
 * So the load-bearing assertion here is not "it renders" — it is that the
 * upload target is the REAL condition's documentType, and that every state the
 * server can report is shown honestly rather than flattened to "needed".
 */

// Plaid-eligible rows mount PlaidConnectButton, which needs a query client.
function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const item = (over: Partial<ChecklistItemView> = {}): ChecklistItemView => ({
  id: "cond-1",
  source: "condition",
  conditionId: "cond-1",
  category: "income",
  documentType: "pay_stub",
  acceptedTypes: ["pay_stub"],
  label: "Most recent pay stubs",
  description: "Covering the last 30 days.",
  required: true,
  status: "needed",
  ...over,
});

describe("DocumentChecklistPanel — the borrower's real checklist", () => {
  it("uploads against the REAL condition documentType", () => {
    // The whole bug in one assertion. This id comes from a loan_condition, so
    // the upload matches a real requirement and the pipeline engine's
    // zero-touch matcher flips it outstanding → submitted.
    render(<DocumentChecklistPanel docs={[item()]} applicationId="app-1" />);
    expect(screen.getByTestId("button-upload-pay_stub")).toBeTruthy();
  });

  it("shows a rejection with the reason the borrower must act on", () => {
    render(
      <DocumentChecklistPanel
        docs={[item({ status: "rejected", rejectionReason: "Page 3 is missing." })]}
        applicationId="app-1"
      />,
    );
    // A rejected item is the one state the borrower cannot self-diagnose: the
    // file IS uploaded, so it looks done, and only the reviewer's reason says
    // why it bounced.
    expect(screen.getByTestId("doc-rejection-pay_stub").textContent).toContain("Page 3 is missing.");
    expect(screen.getByTestId("doc-status-pay_stub").textContent).toMatch(/needs a fix/i);
    expect(screen.getByTestId("button-upload-pay_stub").textContent).toMatch(/re-upload/i);
  });

  it.each([
    ["uploaded", /received/i],
    ["verifying", /in review/i],
    ["verified", /verified/i],
  ] as const)("reports %s honestly instead of flattening it to 'needed'", (status, label) => {
    render(<DocumentChecklistPanel docs={[item({ status })]} applicationId="app-1" />);
    expect(screen.getByTestId("doc-status-pay_stub").textContent).toMatch(label);
  });

  it("offers no upload on work already done", () => {
    // Offering "Upload" beside a verified document invites the borrower to redo
    // work the lender has already accepted.
    render(<DocumentChecklistPanel docs={[item({ status: "verified" })]} applicationId="app-1" />);
    expect(screen.queryByTestId("button-upload-pay_stub")).toBeNull();
  });

  it("renders the staff-authored instructions and the requested year", () => {
    render(
      <DocumentChecklistPanel
        docs={[item({ documentYear: "2025", instructions: "All pages, including blanks." })]}
        applicationId="app-1"
      />,
    );
    expect(screen.getByTestId("doc-item-pay_stub").textContent).toContain("2025");
    expect(screen.getByTestId("doc-item-pay_stub").textContent).toContain("All pages, including blanks.");
  });
});

const status: LoanStatusView = {
  hasApplication: true,
  stage: {
    status: "underwriting",
    label: "Underwriting",
    description: "An underwriter is reviewing your file.",
    progressPercent: 65,
    phase: "processing",
  },
  pipeline: {
    daysInPipeline: 17,
    conditionsOutstanding: 4,
    conditionsTotal: 7,
    percentComplete: 43,
    targetCloseDate: null,
  },
  journey: [{ stepId: "underwriting", lines: ["Conditions cleared: 3 of 7"] }],
  nextAction: {
    kind: "upload_documents",
    title: "Upload your documents — 4 needed",
    description: "Everything on the list unlocks your next stage.",
    href: "/documents",
    buttonLabel: "Upload Documents",
  },
  lastActivityAt: null,
};

describe("StatusPanel — where the file stands", () => {
  it("states the stage and the conditions in the borrower's own terms", () => {
    render(<StatusPanel status={status} />);
    expect(screen.getByTestId("text-stage-label").textContent).toBe("Underwriting");
    expect(screen.getByTestId("text-conditions").textContent).toContain("3 of 7");
    expect(screen.getByTestId("journey-underwriting").textContent).toContain("Conditions cleared: 3 of 7");
  });

  it("marks itself as fact, not suggestion", () => {
    // The defect was never that the assistant suggests things — it is that a
    // suggestion rendered identically to a file-derived panel reads as fact.
    render(<StatusPanel status={status} />);
    expect(screen.getByTestId("badge-panel-source-file").textContent).toMatch(/on your file/i);
  });

  it("renders nothing when there is no application, rather than an empty stage", () => {
    const { container } = render(
      <StatusPanel status={{ ...status, hasApplication: false, stage: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
