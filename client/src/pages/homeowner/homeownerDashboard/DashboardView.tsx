import { Home, MapPin } from "lucide-react";
import { format } from "date-fns";
import { FinancialCards } from "./FinancialCards";
import { EquitySection } from "./EquitySection";
import { RefiAlertsSection } from "./RefiAlertsSection";
import { AnnualReviewSection } from "./AnnualReviewSection";
import { QuickActions } from "./QuickActions";
import type { HomeownerProfile } from "./types";

/** The populated dashboard: header identity plus the five stacked sections. */
export function DashboardView({ profile }: { profile: HomeownerProfile }) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" data-testid="homeowner-dashboard">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Home className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-dashboard-title">
              Homeowner Dashboard
            </h1>
            {profile.propertyAddress && (
              <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-property-address">
                <MapPin className="h-3.5 w-3.5" /> {profile.propertyAddress}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
          {profile.purchaseDate && (
            <span data-testid="text-purchase-date">
              Purchased: {format(new Date(profile.purchaseDate), "MMM d, yyyy")}
            </span>
          )}
          {profile.loanCloseDate && (
            <span data-testid="text-close-date">
              Closed: {format(new Date(profile.loanCloseDate), "MMM d, yyyy")}
            </span>
          )}
          {profile.interestRate && (
            <span data-testid="text-interest-rate">
              Rate: {profile.interestRate}%
            </span>
          )}
        </div>
      </div>

      <FinancialCards profile={profile} />
      <EquitySection profileId={profile.id} />
      <RefiAlertsSection profileId={profile.id} />
      <AnnualReviewSection profile={profile} />
      <QuickActions profile={profile} />
    </div>
  );
}
