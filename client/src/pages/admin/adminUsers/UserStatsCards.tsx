import { type LucideIcon, Home, UserCheck, Users, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserStats } from "@/hooks/useAdminUserStats";

/**
 * The two stat strips above the user table. Eleven cards that differed only in
 * their number, label, icon and testid were eleven hand-written copies of the
 * same markup; they are now two lists rendered through one card each, so a
 * spacing or contrast fix lands on all of them at once instead of ten of
 * eleven.
 */

interface HeadlineStat {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile — the one thing that genuinely varies. */
  tileClassName: string;
  iconClassName: string;
  valueTestId: string;
  cardTestId?: string;
  value: (stats: AdminUserStats) => number;
}

const HEADLINE_STATS: HeadlineStat[] = [
  {
    key: "total",
    label: "Total Users",
    icon: Users,
    tileClassName: "bg-muted",
    iconClassName: "",
    valueTestId: "text-total-users",
    value: (s) => s.total,
  },
  {
    key: "admins",
    label: "Tech/Ops Leads",
    icon: Wrench,
    tileClassName: "bg-destructive-subtle",
    iconClassName: "text-destructive",
    valueTestId: "text-admin-count",
    cardTestId: "card-stat-admins",
    value: (s) => s.admins,
  },
  {
    key: "staff",
    label: "Staff Members",
    icon: UserCheck,
    tileClassName: "bg-info-subtle",
    iconClassName: "text-info",
    valueTestId: "text-staff-count",
    cardTestId: "card-stat-staff",
    value: (s) => s.totalStaff,
  },
  {
    key: "clients",
    label: "Clients",
    icon: Home,
    tileClassName: "bg-success-subtle",
    iconClassName: "text-success-subtle-foreground",
    valueTestId: "text-client-count",
    cardTestId: "card-stat-clients",
    value: (s) => s.totalClients,
  },
];

interface BreakdownStat {
  key: string;
  label: string;
  valueTestId: string;
  /** The Aspiring card is set off from the staff counts by a left rule. */
  divided?: boolean;
  value: (stats: AdminUserStats) => number;
}

const BREAKDOWN_STATS: BreakdownStat[] = [
  { key: "lo", label: "Loan Officers", valueTestId: "text-lo-count", value: (s) => s.loanOfficers },
  { key: "loa", label: "LOAs", valueTestId: "text-loa-count", value: (s) => s.loas },
  { key: "processor", label: "Processors", valueTestId: "text-processor-count", value: (s) => s.processors },
  { key: "underwriter", label: "Underwriters", valueTestId: "text-underwriter-count", value: (s) => s.underwriters },
  { key: "closer", label: "Closers", valueTestId: "text-closer-count", value: (s) => s.closers },
  { key: "aspiring", label: "Aspiring", valueTestId: "text-aspiring-count", divided: true, value: (s) => s.aspiringOwners },
  { key: "activeBuyer", label: "Active Buyers", valueTestId: "text-active-buyer-count", value: (s) => s.activeBuyers },
];

export function UserHeadlineStats({ stats }: { stats: AdminUserStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {HEADLINE_STATS.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key} data-testid={stat.cardTestId}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.tileClassName}`}>
                  <Icon className={`h-5 w-5 ${stat.iconClassName}`.trim()} />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid={stat.valueTestId}>{stat.value(stats)}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function UserRoleBreakdown({ stats }: { stats: AdminUserStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
      {BREAKDOWN_STATS.map((stat) => (
        <Card key={stat.key} className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className={`text-center${stat.divided ? " border-l-2 border-muted pl-2" : ""}`}>
              <p className="text-xl font-bold" data-testid={stat.valueTestId}>{stat.value(stats)}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
