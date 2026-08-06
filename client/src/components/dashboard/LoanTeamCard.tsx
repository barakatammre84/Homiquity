import { useQuery } from "@tanstack/react-query";
import { applicationResourceKeys } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Mail, User, Users } from "lucide-react";

import { CardLabel } from "./CardLabel";

interface TeamMemberUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  role: string;
  // Already returned by GET /api/applications/:id/team (leftJoin users); the old
  // TrustLayer interface just didn't declare it. Render only when present.
  nmlsId: string | null;
}

interface DealTeamMember {
  id: string;
  applicationId: string;
  userId: string | null;
  teamRole: string;
  externalName: string | null;
  externalEmail: string | null;
  isPrimary: boolean;
  isActive: boolean;
  user?: TeamMemberUser;
}

/**
 * "YOUR LOAN TEAM" — the assigned loan officer / processor (split from the old
 * combined TrustLayer). NMLS from `user.nmlsId` only when present (never
 * fabricated). No phone: there is no per-user phone column — the company mainline
 * lives in ContactCard, labeled as such.
 */
export function LoanTeamCard({ applicationId }: { applicationId: string }) {
  const { data: teamMembers } = useQuery<DealTeamMember[]>({
    queryKey: applicationResourceKeys.team(applicationId),
    enabled: !!applicationId,
  });

  const primary =
    teamMembers?.find(
      (m) =>
        m.isPrimary &&
        m.isActive &&
        (m.teamRole === "loan_officer" || m.teamRole === "loan_processor"),
    ) || teamMembers?.find((m) => m.isActive && m.teamRole === "loan_officer");

  const name = primary?.user
    ? `${primary.user.firstName || ""} ${primary.user.lastName || ""}`.trim()
    : primary?.externalName || null;
  const email = primary?.user?.email || primary?.externalEmail || null;
  const image = primary?.user?.profileImageUrl || null;
  const nmls = primary?.user?.nmlsId || null;
  const role = primary?.teamRole === "loan_officer" ? "Loan Officer" : "Processor";

  return (
    <Card className="shadow-card" data-testid="card-loan-team">
      <CardContent className="p-5">
        <CardLabel>Your Loan Team</CardLabel>
        {name ? (
          <div className="flex items-center gap-3" data-testid="loan-team-member">
            <Avatar className="h-11 w-11 shrink-0" data-testid="avatar-loan-team">
              {image && <AvatarImage src={image} alt={name} />}
              <AvatarFallback className="text-xs">
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground" data-testid="text-loan-team-name">
                  {name}
                </p>
                <Badge variant="secondary" className="text-[10px]" data-testid="badge-loan-team-role">
                  <Briefcase className="mr-1 h-2.5 w-2.5" />
                  {role}
                </Badge>
              </div>
              {nmls && (
                <p className="mt-0.5 text-xs text-muted-foreground" data-testid="text-loan-team-nmls">
                  NMLS #{nmls}
                </p>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
                  data-testid="link-loan-team-email"
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3" data-testid="loan-team-unassigned">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-card-border text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">
              Your loan team is being assigned — we'll introduce you shortly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
