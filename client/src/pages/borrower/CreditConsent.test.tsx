import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

function renderPage({ disclosureText }: { disclosureText: string }) {
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
  client.setQueryData(loanApplicationKeys.credit.draft("app-1"), { draft: null });
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
