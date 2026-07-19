import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

// THE document status badge (documents.status → display vocabulary). These
// tests pin the render-level vocabulary the #208 portal train established:
// borrowers see progress language, staff see the literal review state, and a
// document review must never read as a loan decision (Reg N) — the exact bug
// class the old forked per-page maps produced.

const BORROWER_LABELS: Record<string, string> = {
  uploaded: "Under Review",
  verifying: "Under Review",
  verified: "Accepted",
  rejected: "Action Needed",
};

const STAFF_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  verifying: "Needs Review",
  verified: "Verified",
  rejected: "Rejected",
};

describe("DocumentStatusBadge", () => {
  it.each(Object.entries(BORROWER_LABELS))(
    "borrower audience renders %s as %s",
    (status, label) => {
      render(<DocumentStatusBadge status={status} data-testid="badge" />);
      expect(screen.getByTestId("badge").textContent).toBe(label);
    },
  );

  it.each(Object.entries(STAFF_LABELS))(
    "staff audience renders %s as %s",
    (status, label) => {
      render(
        <DocumentStatusBadge status={status} audience="staff" data-testid="badge" />,
      );
      expect(screen.getByTestId("badge").textContent).toBe(label);
    },
  );

  it("never renders loan-decision language on borrower surfaces (Reg N)", () => {
    for (const status of [...Object.keys(BORROWER_LABELS), null, undefined, "weird_status"]) {
      const { unmount } = render(
        <DocumentStatusBadge status={status} data-testid="badge" />,
      );
      const text = screen.getByTestId("badge").textContent ?? "";
      expect(text).not.toMatch(/approv|denied|denial|guarantee/i);
      unmount();
    }
  });

  it("defaults a missing status to the uploaded vocabulary", () => {
    render(<DocumentStatusBadge status={null} data-testid="badge" />);
    expect(screen.getByTestId("badge").textContent).toBe("Under Review");
  });

  it("falls back to a title-cased label for unknown statuses instead of crashing", () => {
    render(<DocumentStatusBadge status="weird_status" data-testid="badge" />);
    expect(screen.getByTestId("badge").textContent).toBe("Weird Status");
  });
});
