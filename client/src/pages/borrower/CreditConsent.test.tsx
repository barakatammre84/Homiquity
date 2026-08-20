import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loanApplicationKeys } from "@/lib/queryClient";

// ux-20: at the credit-pull ask, nothing visible said this is a HARD inquiry —
// the fact existed once, as item 2 of the disclosure document inside a 256px
// ScrollArea, while the checkbox label, the button fine print and the callouts
// all omitted it. It also inverts the expectation the funnel deliberately set
// ("a soft inquiry, which will not affect my credit score").
//
// These tests pin the fix: the hard-inquiry fact is visible AT the decision
// point (callout, checkbox label, fine print) and does not depend on the
// borrower having scrolled the disclosure document — proven by seeding the
// disclosure text EMPTY and asserting the facts still render. The wording
// mirrors the platform's own ratified FCRA disclosure item 2
// (server/services/creditCatalogs.ts): "hard" inquiries "may temporarily
// lower your credit score" — no new compliance language is invented here.

const apiRequest = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("wouter", () => ({
  useParams: () => ({ id: "app-1" }),
  useLocation: () => ["/credit-consent/app-1", vi.fn()],
}));

import CreditConsent from "./CreditConsent";

function renderPage({
  disclosureText,
  draft = null,
}: {
  disclosureText: string;
  /** A previously saved draft, as the server would return it. */
  draft?: Record<string, unknown> | null;
}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Everything the page reads is seeded below; Infinity keeps the seeds
        // authoritative and the stub queryFn makes any unseeded read hang
        // loudly instead of silently resolving.
        staleTime: Infinity,
        queryFn: () => new Promise(() => {}),
      },
    },
  });
  client.setQueryData(loanApplicationKeys.detail("app-1"), {
    id: "app-1",
    status: "documents_pending",
  });
  client.setQueryData(["/api/credit/disclosure"], {
    disclosureText,
    disclosureVersion: "FCRA-2025-v2",
  });
  client.setQueryData(loanApplicationKeys.credit.summary("app-1"), {
    hasActiveConsent: false,
    consent: null,
    latestPull: null,
    pullCount: 0,
    adverseActionCount: 0,
  });
  client.setQueryData(loanApplicationKeys.credit.draft("app-1"), { draft });
  return render(
    <QueryClientProvider client={client}>
      <CreditConsent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  toast.mockReset();
});

describe("ux-20 — the hard-inquiry fact is visible at the ask, not only inside the scrolled document", () => {
  it("shows a hard-inquiry callout at the authorization step even when the disclosure document is empty", () => {
    renderPage({ disclosureText: "" });

    const callout = screen.getByTestId("alert-hard-inquiry");
    expect(callout.textContent).toMatch(/hard credit inquiry/i);
    expect(callout.textContent).toMatch(/may temporarily lower your credit score/i);
  });

  it("names the hard inquiry in the authorization checkbox label itself", () => {
    renderPage({ disclosureText: "" });

    const label = screen.getByTestId("label-acknowledge");
    expect(label.textContent).toMatch(/hard credit inquiry/i);
    expect(label.textContent).toMatch(/may temporarily lower my credit score/i);
  });

  it("names the hard inquiry in the fine print under the authorize button", () => {
    renderPage({ disclosureText: "" });

    const finePrint = screen.getByTestId("text-authorize-fine-print");
    expect(finePrint.textContent).toMatch(/hard credit inquiry/i);
    expect(finePrint.textContent).toMatch(/120 days/);
  });

  it("keeps the disclosure document itself rendered from the server text, unchanged", () => {
    renderPage({
      disclosureText: "CONSUMER CREDIT AUTHORIZATION AND DISCLOSURE\n2. CREDIT INQUIRY TYPE: ...",
    });

    expect(screen.getByTestId("text-disclosure-content").textContent).toContain(
      "CONSUMER CREDIT AUTHORIZATION AND DISCLOSURE",
    );
  });

  it("still gates the authorize button on name + acknowledgment", () => {
    renderPage({ disclosureText: "" });

    // No jest-dom in the client lane (house convention — see Lenders.test.tsx).
    const button = screen.getByTestId("button-authorize-credit") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("a saved draft never pre-ticks the FCRA authorization", () => {
  // The acknowledgment checkbox IS the e-signature evidence for a hard-inquiry
  // authorization, and `acknowledged` is the only gate before the page posts
  // `consentGiven: true`. Restoring it from a draft let a borrower return days
  // later to a pre-checked box and authorize a hard credit pull in a session
  // where they never affirmatively acknowledged anything — possibly against a
  // disclosure version they never saw (DESIGN_SYSTEM §13, Honesty).

  const SAVED_DRAFT = {
    borrowerFullName: "Alex Rivera",
    borrowerSSNLast4: "1234",
    borrowerDOB: "1990-04-01",
    disclosureRead: true,
    acknowledged: true,
    currentStep: 3,
  };

  it("renders the acknowledgment UNCHECKED even when the draft saved it as true", () => {
    renderPage({ disclosureText: "", draft: SAVED_DRAFT });

    expect(screen.getByTestId("checkbox-acknowledge").getAttribute("data-state")).toBe(
      "unchecked",
    );
  });

  it("keeps the authorize button disabled until the borrower re-acknowledges", () => {
    renderPage({ disclosureText: "", draft: SAVED_DRAFT });

    const button = screen.getByTestId("button-authorize-credit") as HTMLButtonElement;
    // The name IS restored, so the only thing still holding the gate shut is
    // the acknowledgment — which is exactly the point.
    expect((screen.getByTestId("input-full-name") as HTMLInputElement).value).toBe(
      "Alex Rivera",
    );
    expect(button.disabled).toBe(true);
  });

  it("re-acknowledging in this session opens the gate", async () => {
    const user = userEvent.setup();
    renderPage({ disclosureText: "", draft: SAVED_DRAFT });

    await user.click(screen.getByTestId("checkbox-acknowledge"));

    expect(screen.getByTestId("checkbox-acknowledge").getAttribute("data-state")).toBe(
      "checked",
    );
    expect((screen.getByTestId("button-authorize-credit") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("still restores the identity fields the draft exists to save", () => {
    renderPage({ disclosureText: "", draft: SAVED_DRAFT });

    expect((screen.getByTestId("input-ssn-last4") as HTMLInputElement).value).toBe("1234");
    expect((screen.getByTestId("input-dob") as HTMLInputElement).value).toBe("1990-04-01");
  });
});

describe("the authorization copy survives the ConsentField migration byte-for-byte", () => {
  it("renders the ratified authorization sentence exactly", () => {
    renderPage({ disclosureText: "" });

    // Byte-for-byte: this string is what the borrower e-signs. DESIGN_SYSTEM
    // §13 requires a redesign to preserve compliance copy exactly, so this
    // asserts equality, not a loose match.
    expect(screen.getByTestId("label-acknowledge").textContent).toBe(
      "I have read and understand the Credit Authorization Disclosure above. I authorize " +
        "Homiquity to obtain my credit report from one or more consumer reporting agencies " +
        "for the purpose of evaluating my mortgage loan application. I understand this " +
        "permits a hard credit inquiry, which may temporarily lower my credit score.",
    );
  });

  it("declining costs nothing, and says so", () => {
    renderPage({ disclosureText: "" });

    const note = screen.getByTestId("text-consent-optional").textContent!;
    expect(note).toMatch(/nothing is submitted until you\s+authorize/);
    expect(note).not.toMatch(/must|required to|will not be able/i);
  });
});
