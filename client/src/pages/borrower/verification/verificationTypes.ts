import { Briefcase, Building2, DollarSign, User } from "lucide-react";
import type { Verification } from "@shared/schema";

export interface VerificationTypeDescriptor {
  type: string;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Required verifications gate the progress card; the others are optional. */
  required: boolean;
}

export const verificationTypes: VerificationTypeDescriptor[] = [
  {
    type: "employment",
    title: "Employment Verification",
    description: "Verify your current employment status and employer information",
    icon: Briefcase,
    required: true,
  },
  {
    type: "identity",
    title: "Identity Verification",
    description: "Confirm your identity through your financial institution",
    icon: User,
    required: true,
  },
  {
    type: "income",
    title: "Income Verification",
    description: "Verify your income through payroll records",
    icon: DollarSign,
    required: false,
  },
  {
    type: "assets",
    title: "Asset Verification",
    description: "Connect your bank accounts to verify assets",
    icon: Building2,
    required: false,
  },
];

export const REQUIRED_VERIFICATION_TYPES = new Set(
  verificationTypes.filter(v => v.required).map(v => v.type),
);

export interface StatusBadgeSpec {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
}

/** An unmapped status shows its raw value rather than rendering blank. */
export function statusBadgeSpec(status: string): StatusBadgeSpec {
  const config: Record<string, StatusBadgeSpec> = {
    pending: { variant: "secondary", label: "Not Started" },
    in_progress: { variant: "outline", label: "In Progress" },
    verified: { variant: "default", label: "Verified" },
    failed: { variant: "destructive", label: "Failed" },
    expired: { variant: "secondary", label: "Expired" },
  };
  return config[status] || { variant: "secondary" as const, label: status };
}

export interface VerificationProgress {
  completedCount: number;
  totalRequired: number;
  allRequiredComplete: boolean;
}

export function verificationProgress(verifications: Verification[] | undefined): VerificationProgress {
  const completedCount = (verifications || []).filter(v => v.status === "verified").length;
  const totalRequired = REQUIRED_VERIFICATION_TYPES.size;
  return { completedCount, totalRequired, allRequiredComplete: completedCount >= totalRequired };
}

export function findVerification(verifications: Verification[] | undefined, type: string) {
  return verifications?.find(v => v.verificationType === type);
}

export function verificationStatus(verifications: Verification[] | undefined, type: string): string {
  return findVerification(verifications, type)?.status || "pending";
}
