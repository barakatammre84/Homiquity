import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Info, 
  Shield,
  Wallet
} from "lucide-react";
import RatePageHeader, { RateRow } from "@/components/RatePageHeader";
import { usePageView } from "@/hooks/useActivityTracker";

interface MortgageRateProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null;
  isAdjustable: boolean | null;
  adjustmentPeriod: string | null;
  loanType: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface MortgageRateWithProgram {
  id: string;
  state: string | null;
  zipcode: string | null;
  programId: string;
  rate: string;
  apr: string;
  points: string | null;
  pointsCost: string | null;
  loanAmount: string | null;
  downPaymentPercent: number | null;
  creditScoreMin: number | null;
  isActive: boolean | null;
  effectiveDate: string | null;
  program: MortgageRateProgram;
}

function getStateFromZip(zip: string): string | undefined {
  const zipNum = parseInt(zip.substring(0, 3));
  if (zipNum >= 900 && zipNum <= 961) return "CA";
  if (zipNum >= 100 && zipNum <= 149) return "NY";
  if (zipNum >= 750 && zipNum <= 799) return "TX";
  if (zipNum >= 330 && zipNum <= 349) return "FL";
  if (zipNum >= 600 && zipNum <= 629) return "IL";
  if (zipNum >= 150 && zipNum <= 196) return "PA";
  if (zipNum >= 430 && zipNum <= 459) return "OH";
  if (zipNum >= 300 && zipNum <= 319) return "GA";
  if (zipNum >= 270 && zipNum <= 289) return "NC";
  if (zipNum >= 480 && zipNum <= 499) return "MI";
  return undefined;
}

export default function HelocRates() {
  usePageView("/rates/heloc");
  const [zipcode, setZipcode] = useState("");
  const [searchZipcode, setSearchZipcode] = useState("");

  const { data: rates, isLoading, isFetching } = useQuery<MortgageRateWithProgram[]>({
    queryKey: ["/api/mortgage-rates", { zipcode: searchZipcode, loanType: "heloc" }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchZipcode) {
        params.append("zipcode", searchZipcode);
        const stateFromZip = getStateFromZip(searchZipcode);
        if (stateFromZip) params.append("state", stateFromZip);
      }
      const res = await fetch(`/api/mortgage-rates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rates");
      return res.json();
    },
  });

  const handleSearch = useCallback(() => {
    if (zipcode.length === 5) {
      setSearchZipcode(zipcode);
    }
  }, [zipcode]);

  const formatTerm = (rate: MortgageRateWithProgram) => {
    if (rate.program.isAdjustable) {
      return `${rate.program.adjustmentPeriod || "Variable"} Rate`;
    }
    return rate.program.termYears ? `${rate.program.termYears}-yr` : "Variable Rate";
  };

  const formatPoints = (rate: MortgageRateWithProgram) => {
    const points = rate.points ? parseFloat(rate.points).toFixed(2) : "0.00";
    const loanAmount = rate.loanAmount ? parseInt(rate.loanAmount) : 100000;
    const pointsCost = Math.round(parseFloat(rate.points || "0") * loanAmount / 100);
    return { points, cost: `$${pointsCost.toLocaleString()}` };
  };

  return (
    <>
      <RatePageHeader
        loanType="heloc"
        title="HELOC rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        onSearch={handleSearch}
        isLoading={isFetching}
        showPropertyValue={true}
        showMortgageBalance={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-background border rounded-lg">
                <div className="flex items-center gap-8">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-28 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : rates && rates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {rates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply?type=heloc"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Access your home equity</h3>
                  <p className="text-muted-foreground">Flexible credit line with competitive rates</p>
                </div>
                <Button asChild className="bg-[#017848] hover:bg-[#015a37] text-white">
                  <Link href="/apply?type=heloc" data-testid="link-apply-heloc">
                    Apply for HELOC
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No HELOC rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current HELOC rates for your area.
              </p>
              <Button asChild className="bg-[#017848] hover:bg-[#015a37] text-white">
                <Link href="/apply?type=heloc" data-testid="link-apply-heloc-empty">
                  Apply for HELOC
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                What is a HELOC?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                A Home Equity Line of Credit (HELOC) is a revolving credit line secured by your home. 
                You can borrow against your home's equity as needed, up to a set limit.
              </p>
              <p>
                Unlike a cash-out refinance, a HELOC is a second mortgage that doesn't replace your 
                current one. You only pay interest on what you borrow, making it flexible for 
                ongoing expenses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                HELOC vs Cash-Out Refinance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">HELOC:</span>
                  Draw funds as needed, variable rate, keeps current mortgage
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Cash-Out:</span>
                  Lump sum, fixed rate option, replaces current mortgage
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Best for HELOC:</span>
                  Ongoing expenses, low current rate, uncertain amount needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Best for Cash-Out:</span>
                  Large one-time expense, high current rate, want fixed payment
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>
                HELOC rates are typically variable and tied to the prime rate. 
                Your actual rate depends on credit score, home equity, and loan amount.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
