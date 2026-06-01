import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import type { LoanApplication } from "@shared/schema";
import {
  Home,
  ChevronRight,
  MessageCircle,
  User,
  DollarSign,
  PiggyBank,
  CreditCard,
  Briefcase,
  MapPin,
  UserPlus,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
}

export default function ApplicationSummary() {
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-8 h-4 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const applications = data?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const loanAmount = activeApplication
    ? parseFloat(activeApplication.purchasePrice || "0") - parseFloat(activeApplication.downPayment || "0")
    : 0;

  const applicantName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email?.split("@")[0] || "Applicant";

  const propertyLocation = activeApplication?.propertyCity && activeApplication?.propertyState
    ? `${activeApplication.propertyCity}, ${activeApplication.propertyState}`
    : activeApplication?.propertyState || "Not specified";

  return (
    <div className="min-h-full">
      <div className="border-b bg-background">
        <div className="p-6 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Application summary
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See your application details here
          </p>
        </div>
      </div>

      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {!activeApplication ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No active application</p>
              <p className="text-sm text-muted-foreground text-center">
                Start your pre-approval to see your application summary
              </p>
              <Button className="mt-6 gap-2" data-testid="button-start-application">
                Start Pre-Approval
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This is what you told us about your finances and property on your application — we're here to help if you need to make any changes.
            </p>

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 flex-wrap">
                    <MessageCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Questions about your application?</p>
                      <p className="text-sm text-muted-foreground">
                        We're happy to help guide you through it or make edits to financial info.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" data-testid="button-contact">
                    Contact info
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider flex-wrap">
                <User className="h-3.5 w-3.5" />
                Applicant
              </div>
              <p className="text-base font-medium" data-testid="text-applicant-name">
                {applicantName}
              </p>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-4 flex-wrap">
                Financial info
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Income</p>
                      <p className="font-semibold" data-testid="text-income">
                        {formatCurrency(activeApplication.annualIncome || "0")}/yr
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">Initial</Badge>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <PiggyBank className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assets</p>
                      <p className="font-semibold" data-testid="text-assets">
                        {formatCurrency(activeApplication.downPayment || "0")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">Initial</Badge>
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Debts</p>
                      <p className="font-semibold" data-testid="text-debts">
                        {formatCurrency(activeApplication.monthlyDebts || "0")}/mo
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">Soft check</Badge>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-4 flex-wrap">
                Loan summary
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted shrink-0">
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Real estate agent</p>
                      <p className="font-medium text-muted-foreground" data-testid="text-agent">
                        Not added
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary shrink-0" data-testid="button-add-agent">
                    Add
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Loan</p>
                    <p className="font-semibold" data-testid="text-loan-amount">
                      {formatCurrency(loanAmount.toString())}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Property info</p>
                    <p className="font-semibold" data-testid="text-property-location">
                      {propertyLocation}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">Ready to make an offer?</p>
                    <p className="text-sm text-muted-foreground">
                      Let us know if you plan on making an offer soon. We're here to help you make your offer as strong as possible.
                    </p>
                  </div>
                  <Button size="sm" className="shrink-0 gap-1" data-testid="button-make-offer">
                    Get started
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
