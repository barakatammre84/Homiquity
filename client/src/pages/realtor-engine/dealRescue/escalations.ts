/**
 * Deal-rescue escalation shaping: ordering, the three desk counters, and the
 * badge/label vocabulary.
 *
 * Extracted verbatim from DealRescue.tsx. Pure — every function that needs the
 * current time takes it as an argument, so nothing here reads the clock.
 */

export interface DealRescueEscalation {
  id: string;
  applicationId: string | null;
  reportedByUserId: string;
  assignedToUserId: string | null;
  urgency: string;
  issueType: string;
  subject: string;
  description: string;
  borrowerName: string | null;
  propertyAddress: string | null;
  closingDate: string | null;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  slaDeadline: string | null;
  createdAt: string;
}

export const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function getUrgencyVariant(urgency: string): "destructive" | "default" | "secondary" | "outline" {
  switch (urgency) {
    case "critical": return "destructive";
    case "high": return "default";
    case "medium": return "secondary";
    case "low": return "outline";
    default: return "secondary";
  }
}

export function getUrgencyClassName(urgency: string): string {
  switch (urgency) {
    case "high": return "bg-warning text-warning-foreground border-border";
    case "medium": return "bg-warning text-warning-foreground border-border";
    case "low": return "bg-info text-info-foreground border-border";
    default: return "";
  }
}

export function getStatusVariant(status: string): "destructive" | "default" | "secondary" | "outline" {
  switch (status) {
    case "open": return "secondary";
    case "in_progress": return "default";
    case "resolved": return "outline";
    default: return "secondary";
  }
}

export function getStatusClassName(status: string): string {
  switch (status) {
    case "open": return "bg-warning text-warning-foreground border-border";
    case "in_progress": return "bg-info text-info-foreground border-border";
    case "resolved": return "bg-success text-success-foreground border-border";
    default: return "";
  }
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "resolved": return "Resolved";
    default: return status;
  }
}

export function formatIssueType(type: string): string {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Most urgent first, then newest first within an urgency band. An unrecognised
 * urgency sorts last (99) rather than first — a value the desk does not
 * understand must never outrank a known "critical".
 */
export function sortEscalations(escalations: DealRescueEscalation[]): DealRescueEscalation[] {
  return [...escalations].sort((a, b) => {
    const urgDiff = (urgencyOrder[a.urgency] ?? 99) - (urgencyOrder[b.urgency] ?? 99);
    if (urgDiff !== 0) return urgDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export interface EscalationStatsSummary {
  openCount: number;
  criticalCount: number;
  /** Pre-formatted for the tile — "N/A" when nothing has been resolved yet. */
  avgResolution: string;
}

export function summariseEscalations(escalations: DealRescueEscalation[]): EscalationStatsSummary {
  const openCount = escalations.filter(e => e.status === "open" || e.status === "in_progress").length;
  const criticalCount = escalations.filter(e => e.urgency === "critical" && e.status !== "resolved").length;

  const resolvedItems = escalations.filter(e => e.resolvedAt && e.createdAt);
  let avgResolution = "N/A";
  if (resolvedItems.length > 0) {
    const totalMs = resolvedItems.reduce((sum, e) => {
      return sum + (new Date(e.resolvedAt!).getTime() - new Date(e.createdAt).getTime());
    }, 0);
    const avgMs = totalMs / resolvedItems.length;
    const avgHours = Math.round(avgMs / (1000 * 60 * 60));
    avgResolution = avgHours < 24 ? `${avgHours}h` : `${Math.round(avgHours / 24)}d`;
  }

  return { openCount, criticalCount, avgResolution };
}

export interface SlaRemaining {
  expired: boolean;
  hours: number;
  minutes: number;
  /** Under four hours left — the countdown turns destructive-coloured. */
  isUrgent: boolean;
}

/** Time left against an SLA deadline, with `now` injected so it stays pure. */
export function slaRemaining(deadline: string, now: Date): SlaRemaining {
  const diffMs = new Date(deadline).getTime() - now.getTime();
  if (diffMs <= 0) return { expired: true, hours: 0, minutes: 0, isUrgent: true };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { expired: false, hours, minutes, isUrgent: hours < 4 };
}
