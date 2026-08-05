import { Badge } from "@/components/ui/badge";

/**
 * Renders both referral-link states (pending/clicked/applied/expired) and
 * application stages (pre_approved/submitted/approved/denied) — the referrals
 * table shows one of each per row.
 */
export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "secondary" },
    clicked: { label: "Clicked", variant: "outline" },
    applied: { label: "Applied", variant: "default" },
    expired: { label: "Expired", variant: "destructive" },
    pre_approved: { label: "Pre-Approved", variant: "default" },
    submitted: { label: "Submitted", variant: "secondary" },
    approved: { label: "Approved", variant: "default" },
    denied: { label: "Denied", variant: "destructive" },
  };
  // Unknown statuses show the raw value rather than blanking the cell.
  const v = variants[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={v.variant} data-testid={`badge-status-${status}`}>{v.label}</Badge>;
}
