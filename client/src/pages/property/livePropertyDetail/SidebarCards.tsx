import { Link } from "wouter";
import { Building, DollarSign, ExternalLink, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PropertyMap } from "@/components/PropertyMap";
import { StreetView } from "@/components/StreetView";
import { formatCurrency } from "@/lib/formatters";
import type { LivePropertyDetail } from "./types";

/**
 * Payment estimate for the listing. Every figure (payment, rate, term, down
 * payment) comes from the server's `mortgage` block — this renders what it is
 * given and derives nothing, so the displayed numbers stay attributable.
 */
export function MortgageEstimateCard({ mortgage }: { mortgage: NonNullable<LivePropertyDetail["mortgage"]> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Estimated Monthly Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 text-center">
          <p className="text-4xl font-bold text-primary" data-testid="text-mortgage-payment">
            {formatCurrency(mortgage.monthlyPayment)}
          </p>
          <p className="text-sm text-muted-foreground">per month</p>
        </div>

        <div className="space-y-3">
          {mortgage.breakdown.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span>{formatCurrency(item.amount)}</span>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Down Payment (20%)</span>
            <span className="font-medium">{formatCurrency(mortgage.downPayment)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="font-medium">{formatCurrency(mortgage.loanAmount)}</span>
          </div>
          {mortgage.rate && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{(mortgage.rate * 100).toFixed(3)}%</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Loan Term</span>
            <span className="font-medium">{mortgage.term} years</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function NeighborhoodCard({ neighborhoods }: { neighborhoods: LivePropertyDetail["neighborhoods"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building className="h-5 w-5" />
          Neighborhood
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {neighborhoods.map((n, i) => (
          <div key={i}>
            <p className="mb-2 font-medium">{n.name}</p>
            <div className="space-y-2 text-sm">
              {n.medianPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median Sold Price</span>
                  <span className="font-medium">{formatCurrency(n.medianPrice)}</span>
                </div>
              )}
              {n.medianListingPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median Listing Price</span>
                  <span className="font-medium">{formatCurrency(n.medianListingPrice)}</span>
                </div>
              )}
              {n.medianPricePerSqft && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per Sqft</span>
                  <span className="font-medium">{formatCurrency(n.medianPricePerSqft)}</span>
                </div>
              )}
              {n.medianDaysOnMarket && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days on Market</span>
                  <span className="font-medium">{n.medianDaysOnMarket}</span>
                </div>
              )}
            </div>
            {i < neighborhoods.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ListedByCard({ branding }: { branding: LivePropertyDetail["branding"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Listed By</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {branding.map((b, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium">{b.name}</p>
            <p className="text-xs text-muted-foreground">{b.type}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function LocationCard({
  coordinate,
  fullAddress,
}: {
  coordinate: NonNullable<LivePropertyDetail["coordinate"]>;
  fullAddress: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Location</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-0 pb-4">
        <div className="overflow-hidden rounded-md mx-4">
          <PropertyMap
            lat={coordinate.lat}
            lng={coordinate.lon}
            address={fullAddress}
          />
        </div>
        <div className="overflow-hidden rounded-md mx-4">
          <StreetView lat={coordinate.lat} lng={coordinate.lon} />
        </div>
      </CardContent>
    </Card>
  );
}

export function InterestedCtaCard({
  price,
  fullAddress,
  href,
}: {
  price: number;
  fullAddress: string;
  href: string | null;
}) {
  return (
    <Card className="bg-primary text-primary-foreground">
      <CardContent className="p-6 text-center">
        <TrendingUp className="mx-auto h-8 w-8" />
        <h3 className="mt-2 text-lg font-semibold">Interested in This Home?</h3>
        <p className="mt-1 text-sm opacity-90">
          Get pre-approved and see personalized loan options
        </p>
        <Button asChild variant="secondary" className="mt-4 w-full" data-testid="button-get-preapproved">
          <Link href={`/pre-approval?price=${price}&address=${encodeURIComponent(fullAddress)}`}>
            Get Pre-Approved
          </Link>
        </Button>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
            <Button variant="outline" className="w-full gap-2 border-primary-foreground/30 text-primary-foreground" data-testid="button-view-external">
              <ExternalLink className="h-4 w-4" />
              View Full Listing
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
