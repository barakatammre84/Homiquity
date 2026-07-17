// The live advisory side panel + dynamic step titles for the pre-approval
// funnel. Extracted verbatim from PreApproval.tsx.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { type PreApprovalFormData } from "@shared/schema";
import type { MortgageRateWithProgram } from "@/types/rates";
import { TrendingUp, Info } from "lucide-react";

import { type Question } from "./questions";

export interface AdvisoryPanelProps {
  formValues: PreApprovalFormData;
  currentStepId: string;
}

// Steps shown before any numbers are entered — the advisory panel has nothing
// useful to show yet, so it (and the right-hand column the main content reserves
// for it) is suppressed. Shared so the panel's visibility and the layout's
// reserved space can never drift apart.
export const ADVISORY_HIDDEN_STEPS: string[] = ["intro", "loanPurpose", "propertyType"];

export function AdvisoryPanel({ formValues, currentStepId }: AdvisoryPanelProps) {
  // Payment estimates use the live advertised 30-year fixed rate — a payment
  // figure shown to a borrower must be reproducible from current pricing,
  // never a hardcoded constant. Falls back to a labeled illustrative rate.
  const { data: advertisedRates } = useQuery<MortgageRateWithProgram[]>({
    queryKey: ["/api/mortgage-rates"],
  });
  const advertised30YrRate = useMemo(() => {
    const row = advertisedRates?.find(
      (r) => r.program?.termYears === 30 && !r.program?.isAdjustable && r.isActive !== false,
    );
    const parsed = row ? parseFloat(row.rate) : NaN;
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }, [advertisedRates]);

  const stats = useMemo(() => {
    let income = parseFloat(String(formValues.annualIncome || "").replace(/[^0-9.]/g, "")) || 0;
    if (formValues.incomeSources && formValues.incomeSources.length > 0) {
      for (const src of formValues.incomeSources) {
        income += parseFloat(String(src.annualAmount || "").replace(/[^0-9.]/g, "")) || 0;
      }
    }
    const debts = parseFloat(String(formValues.monthlyDebts || "").replace(/[^0-9.]/g, "")) || 0;
    const price = parseFloat(String(formValues.purchasePrice || "").replace(/[^0-9.]/g, "")) || 0;
    const down = parseFloat(String(formValues.downPayment || "").replace(/[^0-9.]/g, "")) || 0;
    
    const loanAmount = price - down;
    const estRatePct = advertised30YrRate ?? 6.5;
    const estRate = estRatePct / 100;
    const monthlyRate = estRate / 12;
    const numPayments = 360;
    
    let estMortgage = 0;
    if (loanAmount > 0 && monthlyRate > 0) {
      estMortgage = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1);
      estMortgage += (price * 0.0125) / 12;
    }
    
    const monthlyIncome = income / 12;
    const totalMonthlyObligation = debts + estMortgage;
    
    const dti = monthlyIncome > 0 ? (totalMonthlyObligation / monthlyIncome) * 100 : 0;
    const ltv = price > 0 ? ((price - down) / price) * 100 : 0;
    const downPaymentPercent = price > 0 ? (down / price) * 100 : 0;
    
    return { dti, estMortgage, loanAmount, ltv, downPaymentPercent, estRatePct };
  }, [formValues, advertised30YrRate]);

  if (ADVISORY_HIDDEN_STEPS.includes(currentStepId)) {
    return null;
  }

  const getContextualAdvice = () => {
    switch (currentStepId) {
      case "purchasePrice":
        return "We use this to estimate your monthly payment and closing costs.";
      case "downPayment":
        if (formValues.isVeteran && formValues.loanPurpose === "purchase") {
          return (
            <span className="text-success-subtle-foreground font-medium">
              VA benefit detected: VA loans allow $0 down with no PMI. We'll price both VA and conventional options so you can compare.
            </span>
          );
        }
        if (stats.loanAmount > 766550) {
          return (
            <span className="text-warning-subtle-foreground font-medium">
              Note: This loan amount enters 'Jumbo' territory, which may require a higher credit score and larger down payment.
            </span>
          );
        }
        if (stats.downPaymentPercent >= 20) {
          return (
            <span className="text-success-subtle-foreground">
              Great! Putting 20%+ down avoids PMI (Private Mortgage Insurance), saving you money each month.
            </span>
          );
        }
        return "Tip: A 20% down payment avoids Private Mortgage Insurance (PMI).";
      case "propertyState":
        return "Location affects property taxes and available loan programs.";
      case "householdFamilySize":
        return "VA underwriting checks residual income — what's left after bills — and the required cushion grows with your household size.";
      case "homeSquareFootage":
        return "The VA estimates monthly utilities at $0.14 per square foot when verifying your loan leaves enough residual income.";
      case "annualIncome":
        return "We use gross income to calculate your debt-to-income ratio. We'll verify with W-2s or tax returns later.";
      case "employmentType":
        if (formValues.employmentType === "self_employed") {
          return (
            <span className="text-success-subtle-foreground">
              Self-employed income confuses most automated lenders — not us. We handle 1099 and business income all the time, and we'll build you a custom document checklist so nothing stalls your approval.
            </span>
          );
        }
        return "Employment type helps us determine which documents we'll need to verify your income.";
      case "employmentYears":
        return "Most lenders prefer 2+ years of stable employment history.";
      case "hasAdditionalIncome":
        return "Including all income sources gives a more complete picture for underwriting.";
      case "incomeSources":
        return "Each income source may require different documentation. We'll let you know what's needed.";
      case "monthlyDebts":
        return "Include car payments, student loans, credit cards, and other monthly obligations.";
      case "creditScore":
        return "A score above 740 typically qualifies for the best interest rates. Not sure? Most Americans score between 670-739. Check yours free at annualcreditreport.com.";
      case "veteranAndFirstTime":
        return "Veterans may qualify for VA loans with no down payment. First-time buyers may access special programs.";
      case "final":
        return "Review complete! Click submit to see your personalized loan options.";
      default:
        return "Keep going! We're building your financial profile.";
    }
  };

  const getDtiStatus = () => {
    if (stats.dti <= 0) return { color: "bg-muted", text: "Enter your info to see DTI" };
    if (stats.dti < 36) return { color: "bg-success", text: "Looking great! Lenders love a DTI under 36%." };
    if (stats.dti < 43) return { color: "bg-warning", text: "You're in the approval zone, but consider the budget." };
    if (stats.dti < 50) return { color: "bg-warning", text: "This is getting tight. You may need to reduce the loan amount." };
    return { color: "bg-destructive", text: "This loan amount might be a stretch for standard approval." };
  };

  const dtiStatus = getDtiStatus();

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="hidden lg:block fixed right-8 top-1/2 -translate-y-1/2 w-80 bg-card rounded-2xl shadow-xl border p-6 transition-all duration-500 z-30"
      data-testid="advisory-panel"
    >
      <div className="flex items-center gap-2 mb-4 border-b pb-3">
        <div className="bg-primary/10 p-1.5 rounded-lg">
          <TrendingUp className="w-4 h-4 text-primary" />
        </div>
        <span className="font-bold text-foreground text-sm uppercase tracking-wider">Live Analysis</span>
      </div>

      <div className="space-y-5">
        {(stats.dti > 0 || stats.estMortgage > 0) && (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Debt-to-Income Ratio</span>
              <span className={`font-bold ${stats.dti > 43 ? "text-destructive" : stats.dti > 36 ? "text-warning-subtle-foreground" : "text-success-subtle-foreground"}`}>
                {stats.dti > 0 ? `${stats.dti.toFixed(0)}%` : "—"}
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className={`h-full transition-colors duration-500 ${dtiStatus.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.max(stats.dti, 0), 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {dtiStatus.text}
            </p>
          </div>
        )}

        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getContextualAdvice()}
            </p>
          </div>
        </div>

        {stats.estMortgage > 0 && (
          <div className="text-center pt-2 border-t">
            <div className="text-xs text-muted-foreground uppercase mb-1">Est. Monthly Payment</div>
            <div className="text-2xl font-bold text-foreground" data-testid="text-est-payment">
              ${stats.estMortgage.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-sm text-muted-foreground font-normal">/mo</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Estimate only — based on {advertised30YrRate ? "today's advertised" : "an illustrative"} {stats.estRatePct}% rate,
              30-year fixed, plus estimated taxes and insurance. Not an offer of credit; your rate will differ.
            </p>
          </div>
        )}

        {stats.ltv > 0 && stats.ltv < 100 && (
          <div className="flex justify-between text-xs border-t pt-3">
            <span className="text-muted-foreground">Loan-to-Value (LTV)</span>
            <span className={`font-medium ${stats.ltv <= 80 ? "text-success-subtle-foreground" : "text-warning-subtle-foreground"}`}>
              {stats.ltv.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function getDynamicTitle(currentQ: Question, formValues: PreApprovalFormData): string {
  const { purchasePrice, loanPurpose, employmentType } = formValues;

  switch (currentQ.id) {
    case "downPayment":
      if (purchasePrice) {
        return `On a $${purchasePrice} home, how much can you put down?`;
      }
      break;
    case "creditScore":
      if (loanPurpose === "cash_out") {
        return "Since you're pulling cash out, credit score is key. What's yours?";
      }
      break;
    case "annualIncome":
      return "What's your total household income?";
    case "employmentYears":
      if (employmentType === "self_employed") {
        return "How many years have you been self-employed?";
      }
      if (employmentType === "retired") {
        return "How many years have you been retired?";
      }
      break;
    case "monthlyDebts":
      return "What are your current monthly debt payments?";
  }

  return currentQ.question || "";
}

