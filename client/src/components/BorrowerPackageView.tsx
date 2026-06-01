import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import {
  User,
  Users,
  ArrowRightLeft,
  Briefcase,
  PiggyBank,
  CreditCard,
  Home,
  FileText,
  Target,
  AlertTriangle,
  Shield,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  ClipboardList,
} from "lucide-react";

class PackageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BorrowerPackageView] Render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm">Unable to display borrower package. The data format may be incomplete.</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

interface BorrowerPackageData {
  generatedDate?: string;
  borrowerOverview?: {
    borrowerNames?: string;
    householdComposition?: string;
    primaryResidenceState?: string;
    incomeProfileType?: string;
  };
  householdOverview?: {
    firstTimeBuyer?: string;
    veteranStatus?: string;
  };
  transactionIntent?: {
    transactionType?: string;
    propertyIntent?: string;
    targetTimeframe?: string;
  };
  incomeSources?: Array<{
    source?: string;
    type?: string;
    frequency?: string;
    documentationStatus?: string;
  }>;
  assetSummary?: Array<{
    assetType?: string;
    accountCategory?: string;
    ownershipType?: string;
    documentationStatus?: string;
    lastStatementDate?: string;
    validationNotes?: string;
  }>;
  creditAndDebt?: {
    creditScore?: string;
    creditScoreVerification?: string;
    monthlyDebts?: string;
    monthlyDebtsVerification?: string;
    dtiRatio?: string;
    dtiNote?: string;
  };
  propertyContext?: {
    propertyAddress?: string;
    estimatedValueOrPrice?: string;
    occupancyIntent?: string;
  };
  documentInventory?: Array<{
    docType?: string;
    label?: string;
    status?: string;
    flags?: string[];
  }>;
  readinessStatus?: {
    intakeStatus?: string;
    documentStatus?: string;
    packageStatus?: string;
    pendingItems?: string[];
  };
  auditTrail?: {
    intakeStartDate?: string;
    lastUpdateDate?: string;
    events?: Array<{
      date?: string;
      activity?: string;
    }>;
  };
  validationNotes?: {
    recencyChecks?: string[];
    completenessChecks?: string[];
    consistencyObservations?: string[];
  };
  complianceFooter?: string;
}

const COMPLIANCE_FOOTER = "This intake summary is prepared for informational purposes only. It does not constitute a lending decision, pre-approval, commitment to lend, or assessment of creditworthiness. All information is borrower-declared or document-extracted and has not been independently verified by a lender. Loan eligibility, terms, and approval are determined solely during formal underwriting review.";

function safe(val: string | null | undefined, fallback = "Not Provided"): string {
  if (!val || val.trim() === "") return fallback;
  return val;
}

function isNotProvided(val: string | null | undefined): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return lower === "not provided" || lower === "pending" || lower === "n/a" || lower === "insufficient data" || lower === "";
}

function VerificationBadge({ tier }: { tier: string }) {
  const lower = (tier || "").toLowerCase();
  if (lower.includes("tier 1") || lower.includes("document verified")) {
    return (
      <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-verification-tier1">
        <CheckCircle2 className="w-3 h-3" />
        Tier 1 — Verified
      </Badge>
    );
  }
  if (lower.includes("tier 2") || lower.includes("application declared") || lower.includes("declared")) {
    return (
      <Badge variant="outline" className="text-xs gap-1" data-testid="badge-verification-tier2">
        <Clock className="w-3 h-3" />
        Tier 2 — Declared
      </Badge>
    );
  }
  if (lower.includes("tier 3") || lower.includes("self-reported") || lower.includes("self reported")) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-70" data-testid="badge-verification-tier3">
        <MinusCircle className="w-3 h-3" />
        Tier 3 — Self-Reported
      </Badge>
    );
  }
  if (isNotProvided(tier)) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-50" data-testid="badge-verification-none">
        <XCircle className="w-3 h-3" />
        Not Provided
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs" data-testid="badge-verification-other">{tier}</Badge>;
}

function DocStatusBadge({ status }: { status: string }) {
  const lower = (status || "").toLowerCase();
  if (lower.includes("verified")) {
    return (
      <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-doc-verified">
        <CheckCircle2 className="w-3 h-3" />
        Verified
      </Badge>
    );
  }
  if (lower.includes("pending")) {
    return (
      <Badge variant="outline" className="text-xs gap-1" data-testid="badge-doc-pending">
        <Clock className="w-3 h-3" />
        Pending Review
      </Badge>
    );
  }
  if (lower.includes("not yet") || lower.includes("not received")) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-60" data-testid="badge-doc-missing">
        <XCircle className="w-3 h-3" />
        Not Received
      </Badge>
    );
  }
  if (lower.includes("not required")) {
    return (
      <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-doc-not-required">
        N/A
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs" data-testid="badge-doc-other">{status}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const lower = (status || "").toLowerCase();
  let className = "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
  if (lower === "complete" || lower === "ready for underwriting review") {
    className = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
  } else if (lower === "started" || lower === "partial") {
    className = "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
  } else if (lower === "pending items" || lower === "not started") {
    className = "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200";
  }
  return (
    <Badge className={`text-xs no-default-hover-elevate no-default-active-elevate ${className}`} data-testid={`badge-status-${lower.replace(/\s+/g, "-")}`}>
      {status}
    </Badge>
  );
}

function SectionHeader({ icon: Icon, title, number }: { icon: typeof User; title: string; number: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b" data-testid={`header-section-${number}`}>
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground text-xs font-medium">
        {number}
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold tracking-wide uppercase text-foreground">{title}</h3>
    </div>
  );
}

function DataRow({ label, value, testId, children }: { label: string; value?: string; testId?: string; children?: React.ReactNode }) {
  const displayValue = safe(value);
  const dimmed = isNotProvided(value);
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 ${dimmed ? "opacity-60" : ""}`} data-testid={testId}>
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      {children ? children : <span className="text-sm font-medium text-right">{displayValue}</span>}
    </div>
  );
}

function BorrowerPackageViewInner({ data }: { data: BorrowerPackageData }) {
  if (!data) return null;

  const overview = data.borrowerOverview || {};
  const household = data.householdOverview || {};
  const transaction = data.transactionIntent || {};
  const incomeSources = data.incomeSources || [];
  const assetSummary = data.assetSummary || [];
  const credit = data.creditAndDebt || {};
  const propertyCtx = data.propertyContext || {};
  const documents = data.documentInventory || [];
  const readiness = data.readinessStatus || {};
  const validation = data.validationNotes || {};
  const recencyChecks = validation.recencyChecks || [];
  const completenessChecks = validation.completenessChecks || [];
  const consistencyObservations = validation.consistencyObservations || [];
  const hasValidationNotes = recencyChecks.length > 0 || completenessChecks.length > 0 || consistencyObservations.length > 0;
  const footer = data.complianceFooter || COMPLIANCE_FOOTER;

  return (
    <div className="space-y-4" data-testid="borrower-package">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-foreground" data-testid="text-package-title">
          Borrower Intake Summary
        </h2>
        {data.generatedDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span data-testid="text-generated-date">Generated {data.generatedDate}</span>
          </div>
        )}
      </div>

      <Card data-testid="section-borrower-overview">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={User} title="Borrower Overview" number={1} />
          <div className="space-y-0.5">
            <DataRow label="Borrower Name(s)" value={overview.borrowerNames} testId="row-borrower-names" />
            <DataRow label="Household Composition" value={overview.householdComposition} testId="row-household-composition" />
            <DataRow label="Primary Residence State" value={overview.primaryResidenceState} testId="row-residence-state" />
            <DataRow label="Income Profile Type" value={overview.incomeProfileType} testId="row-income-profile-type" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-household">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={Users} title="Household Details" number={2} />
          <div className="space-y-0.5">
            <DataRow label="First-Time Buyer" value={household.firstTimeBuyer} testId="row-first-time-buyer" />
            <DataRow label="Veteran Status" value={household.veteranStatus} testId="row-veteran-status" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-transaction-intent">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={ArrowRightLeft} title="Transaction Intent" number={3} />
          <div className="space-y-0.5">
            <DataRow label="Transaction Type" value={transaction.transactionType} testId="row-transaction-type" />
            <DataRow label="Property Intent" value={transaction.propertyIntent} testId="row-property-intent" />
            <DataRow label="Target Timeframe" value={transaction.targetTimeframe} testId="row-target-timeframe" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-income">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={Briefcase} title="Declared Income Summary" number={4} />
          {incomeSources.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-income-empty">Not Provided</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-income">
                <thead>
                  <tr className="border-b" data-testid="row-income-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Source</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Income Type</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Frequency</th>
                    <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Documentation</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeSources.map((inc, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-income-${i}`}>
                      <td className="py-1.5 pr-3" data-testid={`text-income-source-${i}`}>{safe(inc.source)}</td>
                      <td className="py-1.5 pr-3" data-testid={`text-income-type-${i}`}>{safe(inc.type)}</td>
                      <td className="py-1.5 pr-3" data-testid={`text-income-frequency-${i}`}>{safe(inc.frequency)}</td>
                      <td className="py-1.5"><DocStatusBadge status={safe(inc.documentationStatus)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-assets">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={PiggyBank} title="Asset Summary" number={5} />
          {assetSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-assets-empty">No assets declared</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-assets">
                <thead>
                  <tr className="border-b" data-testid="row-assets-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Asset Type</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Category</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Ownership</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Documentation</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Last Statement</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assetSummary.map((asset, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-asset-${i}`}>
                      <td className="py-1.5 pr-3 whitespace-nowrap" data-testid={`text-asset-type-${i}`}>{safe(asset.assetType)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap" data-testid={`text-asset-category-${i}`}>{safe(asset.accountCategory)}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap" data-testid={`text-asset-ownership-${i}`}>{safe(asset.ownershipType)}</td>
                      <td className="py-1.5 pr-3" data-testid={`text-asset-doc-status-${i}`}><DocStatusBadge status={safe(asset.documentationStatus)} /></td>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground tabular-nums" data-testid={`text-asset-statement-date-${i}`}>{safe(asset.lastStatementDate)}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground text-xs" data-testid={`text-asset-notes-${i}`}>{asset.validationNotes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-credit">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={CreditCard} title="Credit and Debt Signals" number={6} />
          <div className="space-y-0.5">
            <DataRow label="Credit Score" testId="row-credit-score">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-sm font-medium ${isNotProvided(credit.creditScore) ? "opacity-60" : ""}`}>
                  {safe(credit.creditScore)}
                </span>
                <VerificationBadge tier={safe(credit.creditScoreVerification)} />
              </div>
            </DataRow>
            <DataRow label="Monthly Debts" testId="row-monthly-debts">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-sm font-medium ${isNotProvided(credit.monthlyDebts) ? "opacity-60" : ""}`}>
                  {isNotProvided(credit.monthlyDebts) ? safe(credit.monthlyDebts) : formatCurrency(credit.monthlyDebts!)}
                </span>
                <VerificationBadge tier={safe(credit.monthlyDebtsVerification)} />
              </div>
            </DataRow>
            <DataRow label="DTI Ratio" value={safe(credit.dtiRatio, "Insufficient Data")} testId="row-dti-ratio" />
          </div>
          {credit.dtiNote && !isNotProvided(credit.dtiRatio) && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t italic" data-testid="text-dti-note">
              {credit.dtiNote}
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-property">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={Home} title="Property Context" number={7} />
          <div className="space-y-0.5">
            <DataRow label="Property Address" value={propertyCtx.propertyAddress} testId="row-property-address" />
            <DataRow label="Estimated Value / Purchase Price" testId="row-estimated-value">
              <span className={`text-sm font-medium ${isNotProvided(propertyCtx.estimatedValueOrPrice) ? "opacity-60" : ""}`}>
                {isNotProvided(propertyCtx.estimatedValueOrPrice) ? safe(propertyCtx.estimatedValueOrPrice) : formatCurrency(propertyCtx.estimatedValueOrPrice!)}
              </span>
            </DataRow>
            <DataRow label="Occupancy Intent" value={propertyCtx.occupancyIntent} testId="row-occupancy-intent" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-documents">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={FileText} title="Document Inventory" number={8} />
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-documents-empty">No documents tracked</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-documents">
                <thead>
                  <tr className="border-b" data-testid="row-documents-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Document</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Status</th>
                    <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-doc-${i}`}>
                      <td className="py-1.5 pr-3" data-testid={`text-doc-label-${i}`}>{safe(doc.label, safe(doc.docType))}</td>
                      <td className="py-1.5 pr-3"><DocStatusBadge status={safe(doc.status)} /></td>
                      <td className="py-1.5">
                        {(doc.flags || []).length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(doc.flags || []).map((flag, fi) => (
                              <Badge key={fi} variant="outline" className="text-xs gap-0.5" data-testid={`badge-doc-flag-${i}-${fi}`}>
                                <AlertTriangle className="w-3 h-3" />
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground" data-testid={`text-doc-no-flags-${i}`}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-readiness">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={Target} title="Readiness Status" number={9} />
          <div className="space-y-1">
            <DataRow label="Intake Status" testId="row-intake-status">
              <StatusBadge status={safe(readiness.intakeStatus)} />
            </DataRow>
            <DataRow label="Document Status" testId="row-document-status">
              <StatusBadge status={safe(readiness.documentStatus)} />
            </DataRow>
            <DataRow label="Package Status" testId="row-package-status">
              <StatusBadge status={safe(readiness.packageStatus)} />
            </DataRow>
          </div>
          {(readiness.pendingItems || []).length > 0 && (
            <div className="mt-3 pt-2 border-t" data-testid="list-pending-items">
              <span className="text-xs text-muted-foreground">Pending Items</span>
              <ul className="mt-1 space-y-0.5">
                {(readiness.pendingItems || []).map((item, i) => (
                  <li key={i} className="text-sm flex items-start gap-1.5" data-testid={`text-pending-${i}`}>
                    <Clock className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-audit-trail">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={ClipboardList} title="Audit Trail" number={10} />
          {(() => {
            const audit = data.auditTrail || {};
            const events = audit.events || [];
            return (
              <div className="space-y-3">
                <div className="space-y-1">
                  <DataRow label="Intake Start Date" value={safe(audit.intakeStartDate)} testId="row-intake-start-date" />
                  <DataRow label="Last Update Date" value={safe(audit.lastUpdateDate)} testId="row-last-update-date" />
                </div>
                {events.length > 0 && (
                  <div data-testid="list-audit-events">
                    <span className="text-xs text-muted-foreground">Activity Log</span>
                    <ul className="mt-1.5 space-y-1">
                      {events.map((evt, i) => (
                        <li key={i} className="text-sm flex items-start gap-2" data-testid={`row-audit-event-${i}`}>
                          <Calendar className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground tabular-nums flex-shrink-0">{safe(evt.date)}</span>
                          <span>{safe(evt.activity)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card data-testid="section-validation">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={Shield} title="Validation Notes" number={11} />
          {hasValidationNotes ? (
            <div className="space-y-3">
              {recencyChecks.length > 0 && (
                <div data-testid="list-recency-checks">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Document Recency</span>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    {recencyChecks.map((note, i) => (
                      <li key={i} className="text-sm text-foreground" data-testid={`text-recency-${i}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {completenessChecks.length > 0 && (
                <div data-testid="list-completeness-checks">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completeness</span>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    {completenessChecks.map((note, i) => (
                      <li key={i} className="text-sm text-foreground" data-testid={`text-completeness-${i}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
              {consistencyObservations.length > 0 && (
                <div data-testid="list-consistency-observations">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Consistency</span>
                  </div>
                  <ul className="space-y-0.5 pl-5">
                    {consistencyObservations.map((note, i) => (
                      <li key={i} className="text-sm text-foreground" data-testid={`text-consistency-${i}`}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-validation-issues">No validation concerns identified at this time.</p>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground border-t pt-3 leading-relaxed" data-testid="text-compliance-footer">
        {footer}
      </div>
    </div>
  );
}

export default function BorrowerPackageView({ data }: { data: BorrowerPackageData }) {
  return (
    <PackageErrorBoundary>
      <BorrowerPackageViewInner data={data} />
    </PackageErrorBoundary>
  );
}
