import { useState } from "react";
import { Clock, Lock, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/patterns/EmptyState";
import { formatCurrency } from "@/lib/formatters";
import type { BorrowerOfferView } from "@shared/borrowerOfferView";

export interface MarketOffersResponse {
  status: "PRICED" | "NO_ACTIVE_RATE_SHEETS" | "INSUFFICIENT_PROFILE" | "UNPRICEABLE_PROFILE";
  qualifier: "PRELIMINARY" | "VERIFIED";
  indicative: boolean;
  pricedAt: string;
  lockTermDays: number;
  /** How many wholesale lenders priced this profile — aggregate only, never identity. */
  lenderCount: number;
  assumptions: string[];
  missingItems: string[];
  offers: BorrowerOfferView[];
}

const OFFER_LABELS: Record<string, string> = {
  LOWEST_RATE: "Lowest rate",
  LOWEST_PAYMENT: "Lowest payment",
};

const fmtRatePts = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(3)}%`;

// The endpoint answers with four statuses, and three of them are a real
// borrower state rather than an absence: the profile is too thin to price, the
// matrices do not cover it, or no active rate sheet's product box contains it.
// This section used to `return null` on all three, so the block simply vanished
// and the server's own borrower-facing `missingItems` copy had no reader.
//
// The above-conforming borrower is the one this hurts. Their whole market is a
// single product (BRC-J30, server/seedMarketPricing.ts) with minCreditScore 700
// and maxLTV 89.99, so a jumbo file just outside that box prices to zero offers
// and lands on NO_ACTIVE_RATE_SHEETS more readily than any conforming file.
//
// DESIGN_SYSTEM.md §13: explanation (say what the state is) and honesty (say
// what it is NOT — a statement about today's sheets, never a credit decision).
const UNAVAILABLE_COPY: Record<
  Exclude<MarketOffersResponse["status"], "PRICED">,
  string
> = {
  INSUFFICIENT_PROFILE:
    "We price your profile against live wholesale rate sheets as soon as we have a few more answers.",
  UNPRICEABLE_PROFILE:
    "We price your profile against the wholesale rate sheets that are active today. This one did not price.",
  NO_ACTIVE_RATE_SHEETS:
    "We price your profile against the wholesale rate sheets that are active today, and none of them covers this loan right now. That is a statement about our current sheets — not a decision on your application.",
};

function MarketPricingUnavailable({ market }: { market: MarketOffersResponse }) {
  if (market.status === "PRICED") return null;
  const items = market.missingItems ?? [];

  return (
    <div className="mb-12" data-testid="section-market-pricing-unavailable">
      <h2 className="mb-6 text-2xl font-bold">Live Market Pricing</h2>
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            bordered={false}
            icon={Percent}
            scope="live lender pricing for this profile"
            description={UNAVAILABLE_COPY[market.status]}
          />
          {items.length > 0 && (
            <ul className="mx-auto mt-2 max-w-sm list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {items.map((item) => (
                <li key={item} data-testid="text-market-pricing-missing-item">
                  {item}
                </li>
              ))}
            </ul>
          )}
          <p className="mx-auto mt-4 max-w-sm text-center text-xs text-muted-foreground">
            The payment scenarios below are estimates built from your own answers — not offers,
            and not an approval.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Live market pricing (Binding Contract 2): the borrower's profile priced
 * against active wholesale rate sheets, with the full deterministic rate
 * decomposition. Indicative until the profile is verified — locking stays
 * behind verification, so estimates are never dressed up as commitments.
 *
 * Borrower transparency doctrine: offers arrive from the server already
 * masked (BorrowerOfferView) — neutral "Option A/B/C" labels, no wholesale
 * lender identity. Which lender is behind an option is broker-side only.
 */
export function MarketPricingSection({ market }: { market: MarketOffersResponse }) {
  const [openOffer, setOpenOffer] = useState<string | null>(null);

  if (market.status !== "PRICED") return <MarketPricingUnavailable market={market} />;

  const pricedTime = new Date(market.pricedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const lenderCount = market.lenderCount;

  return (
    <div className="mb-12" data-testid="section-market-pricing">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Live Market Pricing</h2>
            {market.indicative && (
              <Badge variant="outline" className="border-border text-warning-subtle-foreground">
                Indicative
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Your profile priced against {lenderCount} wholesale rate sheet{lenderCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Priced {pricedTime} · {market.lockTermDays}-day lock</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {market.offers.map((offer) => {
          const key = offer.optionId.toLowerCase();
          const bd = offer.pricingBreakdown;
          return (
            <Card
              key={key}
              className={offer.labels.includes("LOWEST_RATE") ? "ring-2 ring-primary" : ""}
              data-testid={`card-market-offer-${key}`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{offer.optionLabel}</CardTitle>
                    <CardDescription>{offer.productLabel}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {offer.labels.map((l) => (
                      <Badge key={l} variant="secondary">{OFFER_LABELS[l] ?? l}</Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Rate</p>
                    <p className="text-2xl font-bold" data-testid={`text-offer-rate-${key}`}>
                      {offer.adjustedRate.toFixed(3)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Est. monthly</p>
                    <p className="text-2xl font-bold">{formatCurrency(String(offer.estimatedMonthlyTotal))}</p>
                    <p className="text-xs text-muted-foreground">
                      P&I {formatCurrency(String(offer.estimatedMonthlyPI))}
                      {offer.estimatedMonthlyMI > 0 && <> + MI {formatCurrency(String(offer.estimatedMonthlyMI))}</>}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setOpenOffer(openOffer === key ? null : key)}
                  data-testid={`button-offer-breakdown-${key}`}
                >
                  <Percent className="mr-2 h-4 w-4" />
                  {openOffer === key ? "Hide rate details" : "Why this rate?"}
                </Button>
                {openOffer === key && (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sheet base rate</span>
                        <span className="font-medium">{bd.baseRate.toFixed(3)}%</span>
                      </div>
                      {bd.llpaAdjustment !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit score & LTV (LLPA)</span>
                          <span className="font-medium">{fmtRatePts(bd.llpaAdjustment)}</span>
                        </div>
                      )}
                      {bd.lockTermAdjustment !== 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{offer.lockTerm}-day lock</span>
                          <span className="font-medium">{fmtRatePts(bd.lockTermAdjustment)}</span>
                        </div>
                      )}
                      {bd.lenderAdjustments.map((a) => (
                        <div key={a.name} className="flex justify-between">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-medium">{fmtRatePts(a.value)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between border-t pt-1.5 text-base">
                        <span className="font-semibold">Final rate</span>
                        <span className="font-bold text-primary">{bd.finalRate.toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {market.indicative && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Verify your income & assets to make this rate lockable</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 space-y-0.5">
        {market.assumptions.map((a) => (
          <p key={a} className="text-xs text-muted-foreground">· {a}</p>
        ))}
      </div>
    </div>
  );
}
