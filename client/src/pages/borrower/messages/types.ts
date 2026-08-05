import type { TeamMessage } from "@shared/schema";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  profileImageUrl: string | null;
  initials: string;
  /** Absent for partners resolved from conversations (no live presence). */
  presenceStatus?: 'online' | 'away' | 'offline';
}

export interface ConversationData {
  partnerId: string;
  lastMessage: TeamMessage;
  unreadCount: number;
  partner: TeamMember | null;
}

/** One row of the conversation list, normalized across the staff/borrower sources. */
export interface ListEntry {
  member: TeamMember;
  lastMessage?: TeamMessage;
  unreadCount: number;
}

// Document types for requesting
export const DOCUMENT_TYPES = [
  { value: "paystub", label: "Recent Pay Stubs", category: "Income" },
  { value: "w2", label: "W-2 Forms", category: "Income" },
  { value: "tax_return_1040", label: "Tax Returns (1040)", category: "Income" },
  { value: "bank_statement_checking", label: "Checking Account Statements", category: "Assets" },
  { value: "bank_statement_savings", label: "Savings Account Statements", category: "Assets" },
  { value: "drivers_license", label: "Driver's License", category: "Identity" },
  { value: "purchase_contract", label: "Purchase Contract", category: "Property" },
  { value: "homeowners_insurance_binder", label: "Homeowners Insurance", category: "Property" },
];

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

export function formatMessageTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}
