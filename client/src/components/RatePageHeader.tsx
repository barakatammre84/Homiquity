import { useState } from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LoanType = "purchase" | "refinance" | "cashout" | "heloc" | "va";

/**
 * The masthead for a public /rates/* page: title, product tabs, the ZIP input,
 * and whatever assumption fields that page wants beside it.
 *
 * COMPOSITION, NOT CONFIGURATION. This used to take eight `show*` booleans and
 * own the fields they revealed. Five of the eight (`showDownPayment`,
 * `showLoanAmount`, `showCreditScore`, `showPropertyType`,
 * `showAdvancedInputs`) were declared in the props type and never destructured
 * — PurchaseRates passed `showDownPayment={true}` and it did nothing at all —
 * because a flag that isn't read fails silently. It also held the amount
 * fields' state internally, where no page could reach it, so the figures a
 * visitor typed reached nothing.
 *
 * Both problems are the same problem, and slots close them by construction: a
 * page passes the fields it wants as children, owns their state (see
 * `useRateSearch`), and a slot that isn't rendered is a visibly missing region
 * rather than an inert boolean.
 */

const loanTypeDescriptions: Record<LoanType, string> = {
  purchase: "purchase mortgage rates",
  refinance: "refinance rates",
  cashout: "cash-out refinance rates",
  heloc: "HELOC rates",
  va: "VA loan rates",
};

interface NavTab {
  label: string;
  href: string;
  loanType: LoanType;
}

const mortgageTabs: NavTab[] = [
  { label: "Purchase", href: "/rates/purchase", loanType: "purchase" },
  { label: "Refinance", href: "/rates/refinance", loanType: "refinance" },
  { label: "VA Loans", href: "/rates/va", loanType: "va" },
];

const homeEquityTabs: NavTab[] = [
  { label: "Home Equity Loans", href: "/rates/refinance", loanType: "refinance" },
  { label: "HELOC", href: "/rates/heloc", loanType: "heloc" },
  { label: "Cash-out Refinance", href: "/rates/cash-out", loanType: "cashout" },
];

const ZIP_LENGTH = 5;

interface RatePageHeaderProps {
  loanType: LoanType;
  title: string;
  zipcode: string;
  onZipcodeChange: (zipcode: string) => void;
  /** Spinner in the ZIP field while a request is in flight. */
  isLoading?: boolean;
  /**
   * Assumption fields rendered beside the ZIP input — compose them from
   * `<AssumptionField>`. The page owns their values.
   */
  assumptions?: React.ReactNode;
  /**
   * Revealed by the "Advanced inputs" toggle. The toggle is not rendered at all
   * when this is omitted: a switch that reveals nothing is the same defect this
   * component was refactored to remove.
   */
  advanced?: React.ReactNode;
}

export default function RatePageHeader({
  loanType,
  title,
  zipcode,
  onZipcodeChange,
  isLoading = false,
  assumptions,
  advanced,
}: RatePageHeaderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-accent/5 dark:bg-primary/5 pb-8">
      <div className="max-w-6xl mx-auto px-4 pt-8 sm:pt-12">
        <h1
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
          data-testid="rate-page-title"
        >
          {title}
        </h1>

        <p className="text-lg text-muted-foreground mb-6">
          Here are today's {loanTypeDescriptions[loanType]} in{" "}
          {zipcode.length === ZIP_LENGTH ? (
            <span className="text-primary font-medium underline">{zipcode}</span>
          ) : (
            <span className="text-muted-foreground">your area</span>
          )}
          . Take the next step by getting a{" "}
          <Link href="/apply" className="text-primary underline font-medium">
            personalized quote
          </Link>{" "}
          in as quick as 3 minutes. No hard credit check.
        </p>

        <Button
          asChild
          className="bg-accent hover:bg-accent/90 text-white mb-8"
          data-testid="button-see-personalized-rates"
        >
          <Link href="/apply">See personalized rates</Link>
        </Button>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-6 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground font-medium">Mortgage</span>
            {mortgageTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "transition-colors",
                  loanType === tab.loanType
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.loanType}`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground font-medium">Home equity</span>
            {homeEquityTabs.map((tab) => (
              <Link
                key={tab.href + tab.label}
                href={tab.href}
                className={cn(
                  "transition-colors",
                  loanType === tab.loanType
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.loanType}-equity`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="flex-shrink-0">
            <Label className="text-xs text-muted-foreground mb-1 block" htmlFor="rate-zipcode">
              Zip code
            </Label>
            <div className="relative">
              <Input
                id="rate-zipcode"
                type="text"
                inputMode="numeric"
                placeholder="Enter ZIP"
                value={zipcode}
                onChange={(e) => onZipcodeChange(e.target.value)}
                className="w-32 h-12 bg-background border rounded-md px-3 font-medium"
                maxLength={ZIP_LENGTH}
                data-testid="input-zipcode"
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>
          </div>

          {assumptions}

          {advanced && (
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-sm text-muted-foreground" htmlFor="rate-advanced">
                Advanced inputs
              </Label>
              <Switch
                id="rate-advanced"
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
                data-testid="switch-advanced-inputs"
              />
            </div>
          )}
        </div>

        {advanced && showAdvanced && (
          <div
            className="flex flex-wrap gap-4 mt-4 p-4 bg-background rounded-lg border"
            data-testid="rate-advanced-panel"
          >
            {advanced}
          </div>
        )}
      </div>
    </div>
  );
}

function formatCurrency(value: string): string {
  const num = parseInt(value.replace(/\D/g, ""), 10) || 0;
  return "$" + num.toLocaleString();
}

interface AssumptionFieldProps {
  label: string;
  /** Raw digits. Rendered as currency; reported back as raw digits. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * One currency assumption beside the ZIP input. Controlled: the page owns the
 * value, which is the whole point of the slot refactor — the previous internal
 * `useState` meant no page could read what the visitor typed.
 */
export function AssumptionField({
  label,
  value,
  onChange,
  className,
  "data-testid": testId,
}: AssumptionFieldProps) {
  const id = `rate-assumption-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="flex-shrink-0">
      <Label className="text-xs text-muted-foreground mb-1 block" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatCurrency(value)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={cn("w-32 h-12 bg-background border rounded-md px-3 font-medium", className)}
        data-testid={testId}
      />
    </div>
  );
}

/**
 * The assumptions the DISPLAYED rates were quoted under, read off the rate rows
 * themselves.
 *
 * This replaces the old "Advanced inputs" panel, which offered a visitor an
 * editable "Credit Score" box (uncontrolled, `defaultValue="760"`) and an
 * editable "Down Payment %" box (uncontrolled, `defaultValue="20%"`) whose
 * values were read by nothing whatsoever, plus a read-only loan amount derived
 * as 80% of the property value. On a public rate-advertising surface an input
 * that implies the quote responds to a credit score it never reads is not a
 * cosmetic problem, so the panel now states what the quote actually assumes
 * instead of inviting an edit that goes nowhere. The wording mirrors the
 * per-rate disclosure /rates already renders (pages/rates/MortgageRates.tsx).
 */
export interface QuotedRate {
  loanAmount?: string | null;
  downPaymentPercent?: number | null;
  creditScoreMin?: number | null;
}

/**
 * Does this rate disclose any assumption worth showing? Pages use it to pick
 * the row to disclose — and passing `undefined` when none does keeps the
 * "Advanced inputs" toggle from revealing an empty panel.
 */
export function hasQuotedAssumptions(rate: QuotedRate): boolean {
  return !!(rate.loanAmount || rate.downPaymentPercent || rate.creditScoreMin);
}
export function QuotedAssumptions({ rate }: { rate: QuotedRate }) {
  const parts: string[] = [];
  if (rate.loanAmount) parts.push(`a $${parseInt(rate.loanAmount, 10).toLocaleString()} loan`);
  if (rate.downPaymentPercent) parts.push(`${rate.downPaymentPercent}% down`);
  if (rate.creditScoreMin) parts.push(`a ${rate.creditScoreMin}+ credit score`);
  if (parts.length === 0) return null;

  return (
    <p className="text-sm text-muted-foreground" data-testid="text-quoted-assumptions">
      The rates below assume {parts.join(", ")}. Your own rate depends on your
      full financial picture —{" "}
      <Link href="/apply" className="text-primary underline font-medium">
        get a personalized quote
      </Link>
      .
    </p>
  );
}

interface RateRowProps {
  term: string;
  rate: string;
  apr: string;
  points: string;
  pointsCost: string;
  ctaHref?: string;
}

export function RateRow({
  term,
  rate,
  apr,
  points,
  pointsCost,
  ctaHref = "/apply"
}: RateRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-6 bg-background border rounded-lg mb-4 hover-elevate" data-testid={`rate-row-${term.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="min-w-[140px]">
        <span className="text-xs text-muted-foreground block mb-1">Term</span>
        <span className="text-2xl font-semibold">{term}</span>
      </div>
      <div className="min-w-[100px]">
        <span className="text-xs text-muted-foreground block mb-1">Rate</span>
        <span className="text-2xl font-semibold text-accent">{rate}</span>
      </div>
      <div className="min-w-[100px]">
        <span className="text-xs text-muted-foreground block mb-1">APR</span>
        <span className="text-2xl font-semibold">{apr}</span>
      </div>
      <div className="min-w-[100px]">
        <span className="text-xs text-muted-foreground block mb-1">Points (cost)</span>
        <span className="text-base font-medium">{points} ({pointsCost})</span>
      </div>
      <Button
        asChild
        variant="outline"
        className="ml-auto"
        data-testid={`button-see-rates-${term.replace(/\s+/g, "-").toLowerCase()}`}
      >
        <Link href={ctaHref}>See my rates</Link>
      </Button>
    </div>
  );
}
