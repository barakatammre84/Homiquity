import { Briefcase, DollarSign, Home, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { ChangeOfCircumstancePanel } from "@/components/staff/ChangeOfCircumstancePanel";
import { RiskBriefPanel } from "@/components/staff/RiskBriefPanel";
import type { LoanApplication, UrlaPersonalInfo } from "@shared/schema";
import { CompensationCard } from "./CompensationCard";

export function OverviewTab({
  application,
  personalInfo,
}: {
  application: LoanApplication;
  personalInfo: UrlaPersonalInfo | null | undefined;
}) {
  return (
    <>
      {/* Compensation election (Reg Z §1026.36(d)(2)) — full width and
          first: with no election the Loan Estimate cannot generate,
          so this is the file's blocking state, not a detail. */}
      <CompensationCard
        applicationId={application.id}
        model={application.loCompensationModel ?? null}
        bps={application.loCompensationBps ?? null}
        leIssued={!!application.leIssuedDate}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Borrower Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Name:</span>
              <span>{personalInfo?.firstName || "N/A"} {personalInfo?.lastName || ""}</span>
              <span className="text-muted-foreground">Email:</span>
              <span>{personalInfo?.email || "N/A"}</span>
              <span className="text-muted-foreground">Phone:</span>
              <span>{personalInfo?.cellPhone || personalInfo?.homePhone || "N/A"}</span>
              {/* Only the last four ever reach the client — the SSN itself is
                  vaulted server-side and never returned (ssnVault). */}
              <span className="text-muted-foreground">SSN:</span>
              <span>XXX-XX-{personalInfo?.ssnLast4 || "XXXX"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Employment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{application.employmentType || "N/A"}</span>
              <span className="text-muted-foreground">Employer:</span>
              <span>{application.employerName || "N/A"}</span>
              <span className="text-muted-foreground">Years:</span>
              <span>{application.employmentYears || 0} years</span>
              <span className="text-muted-foreground">Income:</span>
              <span>{formatCurrency(application.annualIncome)}/year</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Address:</span>
              <span>{application.propertyAddress || "N/A"}</span>
              <span className="text-muted-foreground">City/State:</span>
              <span>{application.propertyCity}, {application.propertyState}</span>
              <span className="text-muted-foreground">Value:</span>
              <span>{formatCurrency(application.propertyValue)}</span>
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{application.propertyType || "SFR"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Loan Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Purpose:</span>
              <span className="capitalize">{application.loanPurpose || "Purchase"}</span>
              <span className="text-muted-foreground">Down Payment:</span>
              <span>{formatCurrency(application.downPayment)}</span>
              <span className="text-muted-foreground">LTV:</span>
              <span>{application.ltvRatio ? `${Number(application.ltvRatio).toFixed(1)}%` : "N/A"}</span>
              <span className="text-muted-foreground">DTI:</span>
              <span>{application.dtiRatio ? `${Number(application.dtiRatio).toFixed(1)}%` : "N/A"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChangeOfCircumstancePanel applicationId={application.id} />

      <RiskBriefPanel applicationId={application.id} />
    </>
  );
}
