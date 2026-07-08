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

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    analyzing: "Analyzing",
    pre_approved: "Pre-Approved",
    verified: "Verified",
    underwriting: "Underwriting",
    approved: "Approved",
    denied: "Denied",
    closed: "Closed",
  };
  return labels[status] || status;
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
