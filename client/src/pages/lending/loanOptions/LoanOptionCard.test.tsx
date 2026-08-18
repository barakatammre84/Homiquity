import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LoanOption } from "@shared/schema";

import { TooltipProvider } from "@/components/ui/tooltip";
import { LoanOptionCard } from "./LoanOptionCard";

// The "Recommended" badge must say WHY (it used to be an unexplained star on
// an unexplained card — and the ordering bug buried it last in the list).

const baseOption = {
  id: "opt-1",
  applicationId: "app-1",
  loanType: "conventional",
  loanTerm: 30,
  interestRate: "6.875",
  apr: "7.125",
  points: "0",
  pointsCost: "0",
  monthlyPayment: "2900.00",
  principalAndInterest: "2400.00",
  propertyTax: "400.00",
  homeInsurance: "100.00",
  pmi: "0",
  loanAmount: "360000.00",
  closingCosts: "10800.00",
  cashToClose: "50800.00",
  downPaymentAmount: "40000.00",
  downPaymentPercent: "10.00",
  isRecommended: false,
  isLocked: false,
} as unknown as LoanOption;

function renderCard(option: LoanOption) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LoanOptionCard
          option={option}
          steeringAcknowledged={true}
          lockPending={false}
          onLockRate={() => {}}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("LoanOptionCard recommendation reason", () => {
  it("explains the conventional starting-point highlight", () => {
    renderCard({ ...baseOption, isRecommended: true } as LoanOption);
    expect(screen.getByTestId("text-recommendation-reason-conventional").textContent).toContain(
      "common starting point",
    );
  });

  it("ties the VA highlight to the borrower's stated veteran status", () => {
    renderCard({ ...baseOption, loanType: "va", isRecommended: true } as LoanOption);
    expect(screen.getByTestId("text-recommendation-reason-va").textContent).toContain("veteran");
  });

  it("renders no reason line on an unrecommended card", () => {
    renderCard(baseOption);
    expect(screen.queryByTestId("text-recommendation-reason-conventional")).toBeNull();
  });
});
