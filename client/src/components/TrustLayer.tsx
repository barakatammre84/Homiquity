import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Clock,
  User,
  Mail,
  Briefcase,
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
  isPrimary: boolean;
  isActive: boolean;
  user?: TeamMemberUser;
}

const STAGE_TIMELINES: Record<string, { label: string; detail: string }> = {
  submitted: { label: "Under review", detail: "Typically a few minutes" },
  analyzing: { label: "Analyzing", detail: "Results within minutes" },
  pre_approved: { label: "Pre-approved", detail: "Valid for 30 days" },
  doc_collection: { label: "Collecting docs", detail: "Depends on your uploads" },
  processing: { label: "Processing", detail: "Usually 3-5 business days" },
  underwriting: { label: "Underwriting", detail: "Typically 1-3 business days" },
  conditional: { label: "Conditional approval", detail: "Clear conditions to finish" },
  clear_to_close: { label: "Clear to close", detail: "Closing scheduled soon" },
  closing: { label: "Closing", detail: "Final steps in progress" },
};

interface TrustLayerProps {
  applicationId: string;
  status: string;
}

export function TrustLayer({ applicationId, status }: TrustLayerProps) {
  const { data: teamMembers } = useQuery<DealTeamMember[]>({
    queryKey: ["/api/applications", applicationId, "team"],
    enabled: !!applicationId,
  });

  const primaryContact = teamMembers?.find(
    (m) => m.isPrimary && m.isActive && (m.teamRole === "loan_officer" || m.teamRole === "loan_processor")
  ) || teamMembers?.find((m) => m.isActive && m.teamRole === "loan_officer");

  const timeline = STAGE_TIMELINES[status];

  const contactName = primaryContact?.user
    ? `${primaryContact.user.firstName || ""} ${primaryContact.user.lastName || ""}`.trim()
    : primaryContact?.externalName || null;

  const contactEmail = primaryContact?.user?.email || primaryContact?.externalEmail || null;
  const contactImage = primaryContact?.user?.profileImageUrl || null;
  const contactRole = primaryContact?.teamRole === "loan_officer" ? "Loan Officer" : "Processor";

  const hasContact = !!contactName;
  const hasTimeline = !!timeline;

  if (!hasContact && !hasTimeline) return null;

  return (
    <div className="space-y-2" data-testid="section-trust-layer">
      <Card data-testid="card-trust-layer">
        <CardContent className="p-4 space-y-4">
          {hasContact && (
            <div className="flex items-center gap-3" data-testid="trust-contact">
              <Avatar className="h-9 w-9 shrink-0" data-testid="avatar-contact">
                {contactImage && <AvatarImage src={contactImage} alt={contactName || ""} />}
                <AvatarFallback className="text-xs">
                  {contactName ? contactName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium" data-testid="text-contact-name">{contactName}</p>
                  <Badge variant="secondary" className="text-[10px]" data-testid="badge-contact-role">
                    <Briefcase className="h-2.5 w-2.5 mr-1" />
                    {contactRole}
                  </Badge>
                </div>
                {contactEmail && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a
                      href={`mailto:${contactEmail}`}
                      className="text-xs text-muted-foreground hover:underline truncate"
                      data-testid="link-contact-email"
                    >
                      {contactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasContact && hasTimeline && <div className="border-t" />}

          {hasTimeline && (
            <div className="flex items-center gap-3" data-testid="trust-timeline">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" data-testid="icon-timeline">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" data-testid="text-timeline-label">{timeline.label}</p>
                <p className="text-xs text-muted-foreground" data-testid="text-timeline-detail">{timeline.detail}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 border-t" data-testid="trust-security">
            <Shield className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed" data-testid="text-security-note">
              Your data is encrypted and stored securely. We never share your information without your consent.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
