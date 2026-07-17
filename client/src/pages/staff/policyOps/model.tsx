// Policy-ops types, the rule-category catalog, and the status badge.
// Extracted verbatim from PolicyOps.tsx.
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Home,
  Percent,
  RefreshCw,
  Shield,
  TrendingDown,
  Briefcase,
  Building,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export type PolicyAuthority = "FANNIE" | "FREDDIE" | "FHA" | "VA" | "BROKER";
export type PolicyStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "RETIRED";
export type RuleCategory = "CREDIT" | "INCOME" | "ASSETS" | "LIABILITIES" | "DTI" | "PROPERTY" | "OCCUPANCY" | "COC" | "PRE_APPROVAL" | "BROKER_OVERLAY";

export interface PolicyProfile {
  id: string;
  profileId: string;
  authority: PolicyAuthority;
  productType: string;
  version: string;
  status: PolicyStatus;
  effectiveDate: string;
  expirationDate: string | null;
  description: string | null;
  bulletinReference: string | null;
  sourceUrl: string | null;
  parentProfileId: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  retiredBy: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyThresholdItem {
  id: string;
  policyProfileId: string;
  category: string;
  thresholdKey: string;
  valueNumeric: string | null;
  valuePercent: string | null;
  valueBool: boolean | null;
  valueEnum: string | null;
  minBound: string | null;
  maxBound: string | null;
  materialityAction: string | null;
  displayName: string | null;
  description: string | null;
  guidelineReference: string | null;
  displayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyProfileDetail extends PolicyProfile {
  thresholds: PolicyThresholdItem[];
  approvals: PolicyApprovalRecord[];
  overlays: unknown[];
}

export interface PolicyApprovalRecord {
  id: string;
  policyProfileId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actionBy: string;
  actionAt: string | null;
  justification: string | null;
  bulletinReference: string | null;
  rejectionReason: string | null;
  impactedApplicationsCount: number | null;
  impactAssessment: unknown;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  changedBy: string;
  changedAt: string;
  changes: string;
  reason: string;
  policyReference?: string;
}

export const RULE_CATEGORIES: { id: RuleCategory; label: string; icon: typeof CreditCard }[] = [
  { id: "CREDIT", label: "Credit", icon: CreditCard },
  { id: "INCOME", label: "Income", icon: DollarSign },
  { id: "ASSETS", label: "Assets", icon: Briefcase },
  { id: "LIABILITIES", label: "Liabilities", icon: TrendingDown },
  { id: "DTI", label: "DTI / DSCR", icon: Percent },
  { id: "PROPERTY", label: "Property", icon: Building },
  { id: "OCCUPANCY", label: "Occupancy", icon: Home },
  { id: "COC", label: "Change-of-Circumstance", icon: RefreshCw },
  { id: "PRE_APPROVAL", label: "Pre-Approval Validity", icon: FileText },
  { id: "BROKER_OVERLAY", label: "Broker Risk Overlay", icon: Shield },
];

export function StatusBadge({ status }: { status: PolicyStatus }) {
  const config = {
    DRAFT: { variant: "secondary" as const, icon: Edit },
    PENDING_APPROVAL: { variant: "outline" as const, icon: Clock },
    APPROVED: { variant: "default" as const, icon: Check },
    ACTIVE: { variant: "default" as const, icon: CheckCircle2 },
    RETIRED: { variant: "secondary" as const, icon: XCircle },
  };
  const { variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status.replace("_", " ")}
    </Badge>
  );
}

