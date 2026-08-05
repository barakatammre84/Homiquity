import {
  Shield,
  UserCheck,
  Briefcase,
  FileCheck,
  ClipboardCheck,
  Banknote,
  Building2,
  Calculator,
  Star,
  Home,
  Users,
  Wrench,
} from "lucide-react";

export interface AdminDisplayUser {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

// Role is a CATEGORY, not a status — a 9-colour rainbow is colourblind-hostile
// and off-system. The icon + label carry identity; colour encodes the one axis
// that matters operationally (internal staff vs external client) via tokens.
export const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield }> = {
  // Staff roles
  admin: { label: "Tech/Ops Lead", icon: Wrench },
  lo: { label: "Loan Officer", icon: UserCheck },
  loa: { label: "LOA", icon: Briefcase },
  processor: { label: "Processor", icon: FileCheck },
  underwriter: { label: "Underwriter", icon: ClipboardCheck },
  closer: { label: "Closer/Funder", icon: Banknote },
  broker: { label: "Broker", icon: Briefcase },
  lender: { label: "Lender", icon: Building2 },
  // Partner roles (self-registering external partners)
  cpa: { label: "CPA", icon: Calculator },
  // Client roles
  aspiring_owner: { label: "Aspiring Owner", icon: Star },
  active_buyer: { label: "Active Buyer", icon: Home },
};

// Never index ROLE_CONFIG directly at a render site: a role present in ALL_ROLES
// (or returned by the API) but missing here would evaluate `.icon`/`.label` on
// undefined and blank the whole page via the error boundary. This helper always
// returns a usable config, degrading to the raw role string + a neutral icon.
export const getRoleConfig = (role: string) =>
  ROLE_CONFIG[role] ?? { label: role, icon: Users };

export const getInitials = (user: AdminDisplayUser) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return "U";
};

export const getDisplayName = (user: AdminDisplayUser) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email || "Unknown User";
};
