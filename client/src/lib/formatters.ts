export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "$0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrencyDecimal(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Controlled currency <input> pair: the field renders a grouped digit string
// ("1,250") while state stays a plain number. Keep them inverse of each other —
// formatInputCurrency omits the "$" because the inputs render their own prefix.
export function formatInputCurrency(value: number): string {
  return value.toLocaleString("en-US");
}

export function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

export function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `${num.toFixed(3)}%`;
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDate(date: Date | string | null | undefined, fallback = "N/A"): string {
  if (!date) return fallback;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "18 yrs 4 mo" from a month count; "0 mo" when nothing remains. */
export function formatDuration(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = Math.round(totalMonths % 12);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} mo`);
  return parts.join(" ") || "0 mo";
}

/**
 * "loan_officer" → "Loan Officer". The last-resort humanizer for snake_case
 * keys with no display mapping — surfaces with curated labels (STAGE_DISPLAY,
 * DOC_TYPE_NAMES, …) should consult their map first and fall back to this.
 */
export function titleCaseFromSnake(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTimeRemaining(minutes: number | null): string {
  if (minutes === null) return "No SLA";
  if (minutes <= 0) return "Overdue";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function getLoanTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    conventional: "Conventional",
    fha: "FHA",
    va: "VA",
  };
  return labels[type] || type;
}

/**
 * Display label for an application status / pipeline stage — one vocabulary:
 * the server's pipeline `currentStage` IS `application.status`
 * (server/pipelineEngine.ts), so status labels and stage labels must never
 * diverge. This map is the single source; unmapped keys humanize instead of
 * leaking raw snake_case.
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    analyzing: "Analyzing",
    under_review: "Under Review",
    pre_approved: "Pre-Approved",
    verified: "Verified",
    doc_collection: "Doc Collection",
    processing: "Processing",
    underwriting: "Underwriting",
    conditional: "Conditional Approval",
    clear_to_close: "Clear to Close",
    closing: "Closing",
    approved: "Approved",
    denied: "Denied",
    funded: "Funded",
    withdrawn: "Withdrawn",
    suspended: "Suspended",
    expired: "Expired",
    closed: "Closed",
  };
  return labels[status] || titleCaseFromSnake(status);
}

/**
 * Display label for a DOCUMENT's review status (documents.status — vocabulary
 * in shared/documentStatus.ts). Distinct from getStatusLabel above, which is
 * the application/pipeline-stage map. The borrower audience deliberately
 * collapses the internal uploaded/verifying distinction into "Under Review"
 * (AI staging is internal machinery) and says "Accepted" — never "Approved":
 * a document review must not read as a loan decision (Reg N).
 */
export function getDocumentStatusLabel(
  status: string | null | undefined,
  audience: "borrower" | "staff" = "borrower",
): string {
  const labels: Record<string, { borrower: string; staff: string }> = {
    uploaded: { borrower: "Under Review", staff: "Uploaded" },
    verifying: { borrower: "Under Review", staff: "Needs Review" },
    verified: { borrower: "Accepted", staff: "Verified" },
    rejected: { borrower: "Action Needed", staff: "Rejected" },
  };
  const key = status || "uploaded";
  return labels[key]?.[audience] ?? titleCaseFromSnake(key);
}

interface MortgageRateProgram {
  termYears: number | null;
  isAdjustable: boolean | null;
  adjustmentPeriod: string | null;
}

interface MortgageRateWithProgramBase {
  points: string | null;
  loanAmount: string | null;
  program: MortgageRateProgram;
}

export function formatRateTerm(rate: MortgageRateWithProgramBase, isHeloc = false): string {
  if (rate.program.isAdjustable) {
    return isHeloc
      ? `${rate.program.adjustmentPeriod || "Variable"} Rate`
      : `${rate.program.adjustmentPeriod || "5/1"} ARM`;
  }
  const years = rate.program.termYears;
  return isHeloc ? (years ? `${years}-yr` : "Variable Rate") : `${years}-yr fixed`;
}

export function formatRatePoints(
  rate: MortgageRateWithProgramBase,
  defaultLoanAmount = 300000,
): { points: string; cost: string } {
  const points = rate.points ? parseFloat(rate.points).toFixed(2) : "0.00";
  const loanAmount = rate.loanAmount ? parseInt(rate.loanAmount) : defaultLoanAmount;
  const pointsCost = Math.round(parseFloat(rate.points || "0") * loanAmount / 100);
  return { points, cost: `$${pointsCost.toLocaleString()}` };
}

export function getPresenceColor(status: string): string {
  switch (status) {
    case "online": return "text-status-online";
    case "away": return "text-status-away";
    default: return "text-muted-foreground";
  }
}

export function getPresenceLabel(status: string): string {
  switch (status) {
    case "online": return "Online";
    case "away": return "Away";
    default: return "Offline";
  }
}

export function getStatusColor(status: string): string {
  // Charcoal Emerald: in-flight states stay on the monochromatic ramp;
  // status-* pop colors are reserved for approval/denial semantics.
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-primary/10 text-primary",
    analyzing: "bg-status-warning/15 text-status-warning",
    pre_approved: "bg-status-success/15 text-status-success",
    verified: "bg-status-success/15 text-status-success",
    underwriting: "bg-primary/15 text-primary",
    approved: "bg-status-success/15 text-status-success",
    denied: "bg-status-danger/15 text-status-danger",
    closed: "bg-muted text-muted-foreground",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}
