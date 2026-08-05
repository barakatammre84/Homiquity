import { useState, useMemo, useEffect, useRef } from "react";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { calculateAffordabilityEstimate } from "@/lib/affordabilityEstimate";
import { PresalesDisclaimer } from "@/components/PresalesDisclaimer";
import { SEOHead } from "@/components/SEOHead";
import { PageShell } from "@/components/PageShell";
import { IncomeCard } from "./affordabilityCalculator/IncomeCard";
import { DebtsCard } from "./affordabilityCalculator/DebtsCard";
import { LoanDetailsCard } from "./affordabilityCalculator/LoanDetailsCard";
import { ResultsSidebar } from "./affordabilityCalculator/ResultsSidebar";
import { PaymentBreakdownCard } from "./affordabilityCalculator/PaymentBreakdownCard";
import { PriceRangesCard } from "./affordabilityCalculator/PriceRangesCard";
import { DTICard } from "./affordabilityCalculator/DTICard";
import { defaultInputs, type AffordabilityInputs, type DebtItem } from "./affordabilityCalculator/types";

export default function AffordabilityCalculator() {
  const [inputs, setInputs] = useState<AffordabilityInputs>(defaultInputs);
  const [debts, setDebts] = useState<DebtItem[]>([]);

  usePageView("/calculators/affordability");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculateAffordabilityEstimate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/affordability", { type: "affordability" });
    }
  }, [trackActivity]);

  const totalDebtPayments = useMemo(() => {
    return debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  }, [debts]);

  useEffect(() => {
    setInputs((prev) => ({ ...prev, monthlyDebts: totalDebtPayments }));
  }, [totalDebtPayments]);

  const updateInput = (field: keyof AffordabilityInputs, value: number | string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mortgage Affordability Calculator — How Much Home Can You Afford?"
        description="Free mortgage affordability calculator. Adjust income, monthly debts, down payment, and credit score with interactive sliders to see your comfortable home price range — no sign-up, no credit check."
      />
      <PageShell width="wide">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            How Much Home Can You Afford?
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            See your homebuying budget in minutes. Adjust your income, debts, and down payment to find your comfortable price range.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <IncomeCard
              annualIncome={inputs.annualIncome}
              onChange={(value) => updateInput("annualIncome", value)}
            />

            <DebtsCard debts={debts} onDebtsChange={setDebts} />

            <LoanDetailsCard inputs={inputs} updateInput={updateInput} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <ResultsSidebar inputs={inputs} debts={debts} results={results} />

            <PaymentBreakdownCard results={results} hoaMonthly={inputs.hoaMonthly} />

            <PriceRangesCard results={results} />

            <DTICard results={results} />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
