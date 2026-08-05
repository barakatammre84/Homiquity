import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Home } from "lucide-react";
import { CostLineItem } from "./CostLineItem";
import type { LoanEstimateData } from "./types";

export function ProjectedPaymentsCard({ le }: { le: LoanEstimateData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Projected Payments
        </CardTitle>
        <CardDescription>
          Your estimated monthly payment over the life of the loan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold mb-3">Years 1-5</h4>
            <CostLineItem label="Principal & Interest" amount={le.projectedPayments.years1Through5.principalAndInterest} />
            <CostLineItem label="Mortgage Insurance" amount={le.projectedPayments.years1Through5.mortgageInsurance} />
            <CostLineItem label="Estimated Escrow" amount={le.projectedPayments.years1Through5.estimatedEscrow} />
            <Separator className="my-2" />
            <CostLineItem label="Estimated Total" amount={le.projectedPayments.years1Through5.estimatedTotal} bold />
          </div>

          {le.projectedPayments.years6Through30 && (
            <div className="rounded-lg border p-4">
              <h4 className="font-semibold mb-3">Years 6-30</h4>
              <CostLineItem label="Principal & Interest" amount={le.projectedPayments.years6Through30.principalAndInterest} />
              <CostLineItem label="Mortgage Insurance" amount={le.projectedPayments.years6Through30.mortgageInsurance} />
              <CostLineItem label="Estimated Escrow" amount={le.projectedPayments.years6Through30.estimatedEscrow} />
              <Separator className="my-2" />
              <CostLineItem label="Estimated Total" amount={le.projectedPayments.years6Through30.estimatedTotal} bold />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CostsAtClosingCard({ le }: { le: LoanEstimateData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Costs at Closing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Estimated Closing Costs</p>
            <p className="text-3xl font-bold" data-testid="text-closing-costs">
              {le.costsAtClosing.estimatedClosingCostsFormatted}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Includes loan costs + other costs
            </p>
          </div>
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Estimated Cash to Close</p>
            <p className="text-3xl font-bold text-primary" data-testid="text-cash-to-close">
              {le.costsAtClosing.estimatedCashToCloseFormatted}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Includes down payment
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The itemized A/B breakdown. Section lettering and grouping follow the
 * Loan Estimate form's own structure (A. Loan Costs / B. Other Costs), so the
 * borrower can line this up against page 2 of the printed disclosure.
 */
export function ClosingCostDetailsCard({ le }: { le: LoanEstimateData }) {
  const { loanCosts, otherCosts } = le.closingCostDetails;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Closing Cost Details</CardTitle>
        <CardDescription>Itemized breakdown of all closing costs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-semibold text-lg mb-3">A. Loan Costs</h4>

          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Origination Charges</h5>
              <CostLineItem label="Origination Fee" amount={loanCosts.originationCharges.originationFee} />
              <CostLineItem label="Points" amount={loanCosts.originationCharges.points} />
              <CostLineItem label="Application Fee" amount={loanCosts.originationCharges.applicationFee} />
              <CostLineItem label="Underwriting Fee" amount={loanCosts.originationCharges.underwritingFee} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={loanCosts.originationCharges.total} bold />
            </div>

            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Services You Cannot Shop For</h5>
              <CostLineItem label="Appraisal" amount={loanCosts.servicesYouCannotShopFor.appraisal} />
              <CostLineItem label="Credit Report" amount={loanCosts.servicesYouCannotShopFor.creditReport} />
              <CostLineItem label="Flood Determination" amount={loanCosts.servicesYouCannotShopFor.floodDetermination} />
              <CostLineItem label="Tax Service" amount={loanCosts.servicesYouCannotShopFor.taxService} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={loanCosts.servicesYouCannotShopFor.total} bold />
            </div>

            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Services You Can Shop For</h5>
              <CostLineItem label="Title Insurance" amount={loanCosts.servicesYouCanShopFor.titleInsurance} />
              <CostLineItem label="Title Search" amount={loanCosts.servicesYouCanShopFor.titleSearch} />
              <CostLineItem label="Survey" amount={loanCosts.servicesYouCanShopFor.surveyFee} />
              <CostLineItem label="Pest Inspection" amount={loanCosts.servicesYouCanShopFor.pestInspection} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={loanCosts.servicesYouCanShopFor.total} bold />
            </div>

            <div className="bg-muted rounded-lg p-3">
              <CostLineItem label="Total Loan Costs (A)" amount={loanCosts.totalLoanCosts} bold />
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-semibold text-lg mb-3">B. Other Costs</h4>

          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Taxes and Government Fees</h5>
              <CostLineItem label="Recording Fees" amount={otherCosts.taxesAndGovernmentFees.recordingFees} />
              <CostLineItem label="Transfer Taxes" amount={otherCosts.taxesAndGovernmentFees.transferTaxes} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={otherCosts.taxesAndGovernmentFees.total} bold />
            </div>

            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Prepaids</h5>
              <CostLineItem label="Homeowner's Insurance" amount={otherCosts.prepaids.homeownersInsurance} />
              <CostLineItem label="Mortgage Insurance" amount={otherCosts.prepaids.mortgageInsurance} />
              <CostLineItem label="Prepaid Interest" amount={otherCosts.prepaids.prepaidInterest} />
              <CostLineItem label="Property Taxes" amount={otherCosts.prepaids.propertyTaxes} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={otherCosts.prepaids.total} bold />
            </div>

            <div className="rounded-lg border p-3">
              <h5 className="font-medium mb-2">Initial Escrow Payment at Closing</h5>
              <CostLineItem label="Homeowner's Insurance" amount={otherCosts.initialEscrowPaymentAtClosing.homeownersInsurance} />
              <CostLineItem label="Mortgage Insurance" amount={otherCosts.initialEscrowPaymentAtClosing.mortgageInsurance} />
              <CostLineItem label="Property Taxes" amount={otherCosts.initialEscrowPaymentAtClosing.propertyTaxes} />
              <Separator className="my-1" />
              <CostLineItem label="Subtotal" amount={otherCosts.initialEscrowPaymentAtClosing.total} bold />
            </div>

            <div className="bg-muted rounded-lg p-3">
              <CostLineItem label="Total Other Costs (B)" amount={otherCosts.totalOtherCosts} bold />
            </div>
          </div>
        </div>

        <Separator />

        <div className="bg-primary/10 rounded-lg p-4">
          <CostLineItem label="Total Closing Costs (A + B)" amount={le.closingCostDetails.totalClosingCosts} bold />
          {le.lenderCredits > 0 && (
            <CostLineItem label="Lender Credits" amount={-le.lenderCredits} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
