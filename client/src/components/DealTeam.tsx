import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Mail, 
  Phone, 
  Building,
  Briefcase,
  Home,
  FileText,
  Shield,
  Scale,
  UserCheck,
  Users,
} from "lucide-react";

interface TeamMemberUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  role: string;
}

interface DealTeamMember {
  id: string;
  applicationId: string;
  userId: string | null;
  teamRole: string;
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  externalCompany: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  user?: TeamMemberUser;
}

const roleIcons: Record<string, typeof User> = {
  loan_officer: Briefcase,
  loan_processor: FileText,
  underwriter: Shield,
  closer: UserCheck,
  real_estate_agent: Home,
  title_agent: FileText,
  appraiser: Building,
  insurance_agent: Shield,
  attorney: Scale,
  escrow_officer: Users,
};

const roleLabels: Record<string, string> = {
  loan_officer: "Loan Officer",
  loan_processor: "Loan Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  real_estate_agent: "Real Estate Agent",
  title_agent: "Title Agent",
  appraiser: "Appraiser",
  insurance_agent: "Insurance Agent",
  attorney: "Attorney",
  escrow_officer: "Escrow Officer",
};

const roleColors: Record<string, string> = {
  loan_officer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  loan_processor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  underwriter: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  real_estate_agent: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  title_agent: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  appraiser: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  insurance_agent: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  attorney: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  escrow_officer: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
};

interface DealTeamProps {
  applicationId: string;
  compact?: boolean;
}

export function DealTeam({ applicationId, compact = false }: DealTeamProps) {
  const { data: team, isLoading } = useQuery<DealTeamMember[]>({
    queryKey: ["/api/applications", applicationId, "team"],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/team`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!team || team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Your team will be assigned soon</p>
            <p className="text-sm mt-1">We're finding the right experts to help with your loan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by role for display
  const groupedTeam = team.reduce((acc, member) => {
    const role = member.teamRole;
    if (!acc[role]) acc[role] = [];
    acc[role].push(member);
    return acc;
  }, {} as Record<string, DealTeamMember[]>);

  // Order roles for display
  const roleOrder = [
    "loan_officer",
    "loan_processor",
    "underwriter",
    "closer",
    "real_estate_agent",
    "title_agent",
    "appraiser",
    "attorney",
    "escrow_officer",
    "insurance_agent",
  ];

  const sortedRoles = Object.keys(groupedTeam).sort((a, b) => {
    const aIndex = roleOrder.indexOf(a);
    const bIndex = roleOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  if (compact) {
    return (
      <Card data-testid="card-deal-team-compact">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Team ({team.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {team.slice(0, 5).map((member) => {
              const name = member.user 
                ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                : member.externalName || 'Team Member';
              const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TM';
              
              return (
                <div 
                  key={member.id} 
                  className="flex items-center gap-2 p-2 rounded-lg border"
                  data-testid={`team-member-${member.id}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <p className="font-medium leading-none">{name}</p>
                    <p className="text-muted-foreground text-xs">
                      {roleLabels[member.teamRole] || member.teamRole}
                    </p>
                  </div>
                </div>
              );
            })}
            {team.length > 5 && (
              <Badge variant="secondary">+{team.length - 5} more</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-deal-team">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Team
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedRoles.map((role) => (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const Icon = roleIcons[role] || User;
                  return <Icon className="h-4 w-4 text-muted-foreground" />;
                })()}
                <span className="text-sm font-medium text-muted-foreground">
                  {roleLabels[role] || role.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="space-y-2 ml-6">
                {groupedTeam[role].map((member) => {
                  const name = member.user 
                    ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                    : member.externalName || 'Team Member';
                  const email = member.user?.email || member.externalEmail;
                  const phone = member.externalPhone;
                  const company = member.externalCompany;
                  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TM';

                  return (
                    <div 
                      key={member.id} 
                      className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`team-member-${member.id}`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user?.profileImageUrl || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{name}</span>
                          {member.isPrimary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        {company && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                            <Building className="h-3 w-3" />
                            <span>{company}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2">
                          {email && (
                            <a 
                              href={`mailto:${email}`}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                              data-testid={`email-${member.id}`}
                            >
                              <Mail className="h-3 w-3" />
                              <span className="truncate max-w-[180px]">{email}</span>
                            </a>
                          )}
                          {phone && (
                            <a 
                              href={`tel:${phone}`}
                              className="flex items-center gap-1 text-sm text-primary hover:underline"
                              data-testid={`phone-${member.id}`}
                            >
                              <Phone className="h-3 w-3" />
                              <span>{phone}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}