import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Circle, FileText, Landmark, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlaidConnectButton } from "@/components/PlaidConnectButton";

/** Bank/asset items verify as "assets"; income/employment docs as "income". */
function plaidVerificationType(doc: DocumentRequirement): "assets" | "income" {
  return /income|employ|pay.?stub|w-?2|1099|profit|salary/i.test(`${doc.docType} ${doc.category} ${doc.label}`)
    ? "income"
    : "assets";
}
import {
  CATEGORY_ICONS,
  TIER_CONFIG,
  type ActionPlanItem,
  type CoachProfile,
  type DocumentRequirement,
} from "./types";

// Assessment side panels, moved from the old page-local components in
// AICoach.tsx (markup unchanged).

export function ReadinessPanel({ profile }: { profile: CoachProfile }) {
  const tier = TIER_CONFIG[profile.readinessTier] || TIER_CONFIG.exploring;
  const TierIcon = tier.icon;

  return (
    <Card data-testid="card-readiness-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          Your Readiness Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`p-2 rounded-lg ${tier.color}/10`}>
            <TierIcon className={`h-5 w-5 ${tier.color.replace("bg-", "text-")}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground" data-testid="text-readiness-tier">{tier.label}</span>
              <Badge variant="secondary" className="text-xs" data-testid="badge-readiness-score">
                {profile.completionPercentage}% Complete
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.estimatedTimeline}</p>
          </div>
        </div>
        <Progress value={profile.completionPercentage} className="h-2" data-testid="progress-readiness" />
        <p className="text-sm text-muted-foreground" data-testid="text-readiness-summary">{profile.statusNote}</p>

        {profile.completedInputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">COMPLETED INPUTS</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.completedInputs.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.outstandingInputs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">OUTSTANDING INPUTS</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.outstandingInputs.map((g, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(profile.readinessTier === "ready_now" || profile.readinessTier === "almost_ready") && (
          <div className="pt-2 border-t space-y-2">
            <Link href={`/apply?source=coach&readiness=${profile.readinessTier}`} data-testid="link-ready-to-apply">
              <Button className="w-full gap-2" data-testid="button-ready-to-apply">
                <FileText className="h-4 w-4" />
                {profile.readinessTier === "ready_now"
                  ? "Start Your Pre-Approval"
                  : "Get a Head Start on Your Application"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center">
              Your coach data will be used to pre-fill the application
            </p>
          </div>
        )}
        {profile.readinessTier !== "ready_now" && profile.readinessTier !== "almost_ready" && (
          <div className="pt-2 border-t">
            <Link href="/apply?source=coach" data-testid="link-explore-apply">
              <Button variant="outline" className="w-full gap-2" data-testid="button-explore-apply">
                <FileText className="h-4 w-4" />
                Explore Pre-Approval Anyway
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-2">
              See where you stand with a no-impact pre-approval check
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ActionPlanPanel({
  plan,
  onToggle,
}: {
  plan: ActionPlanItem[];
  onToggle?: (itemId: string) => void;
}) {
  const completedCount = plan.filter(a => a.completed).length;

  return (
    <Card data-testid="card-action-plan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Your Action Plan
          </span>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{plan.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {plan.map((item) => {
            const CatIcon = CATEGORY_ICONS[item.category] || Target;
            return (
              <button
                key={item.id}
                onClick={() => onToggle?.(item.id)}
                className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                  item.completed ? "bg-muted/50 border-muted" : "border-border hover-elevate"
                }`}
                data-testid={`action-item-${item.id}`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.title}
                    </span>
                    <Badge
                      variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </button>
            );
          })}
        </div>
        {completedCount > 0 && completedCount < plan.length && (
          <div className="mt-3">
            <Progress value={(completedCount / plan.length) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              {completedCount} of {plan.length} completed
            </p>
          </div>
        )}
        {completedCount === plan.length && plan.length > 0 && (
          <div className="mt-3 p-2 rounded-lg bg-success/10 text-center">
            <p className="text-xs font-medium text-success-subtle-foreground">
              All action items completed!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DocumentChecklistPanel({
  docs,
  applicationId,
}: {
  docs: DocumentRequirement[];
  applicationId?: string | null;
}) {
  const grouped = docs.reduce((acc, d) => {
    const cat = d.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {} as Record<string, DocumentRequirement[]>);

  return (
    <Card data-testid="card-document-checklist">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-primary" />
          Your Document Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{category}</p>
              <div className="space-y-1.5">
                {items.map((doc, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover-elevate" data-testid={`doc-item-${doc.docType}`}>
                    <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">{doc.label}</span>
                        <Badge
                          variant={doc.priority === "required" ? "destructive" : doc.priority === "recommended" ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {doc.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{doc.reason}</p>
                      {doc.plaidEligible && (
                        applicationId ? (
                          <PlaidConnectButton
                            applicationId={applicationId}
                            verificationType={plaidVerificationType(doc)}
                            label="Connect with Plaid instead"
                            className="mt-1.5 h-7 text-xs"
                            testId={`button-plaid-connect-${doc.docType}`}
                          />
                        ) : (
                          <Link href="/verification">
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1.5 h-7 gap-1.5 text-xs"
                              data-testid={`button-plaid-connect-${doc.docType}`}
                            >
                              <Landmark className="h-3.5 w-3.5" />
                              Connect with Plaid instead
                            </Button>
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Inline "connect your bank" prompt shown in the chat stream (not just the side
 * panel) when the checklist has a Plaid-eligible item and we have an application
 * to attach the connection to — so the borrower can act without hunting for it.
 */
export function ConnectBankInlineCTA({ applicationId }: { applicationId: string }) {
  return (
    <div
      className="mx-auto mb-2 flex max-w-2xl items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2"
      data-testid="coach-plaid-inline-cta"
    >
      <Landmark className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">Connect your bank to verify assets in seconds</p>
        <p className="text-[11px] text-muted-foreground">
          Faster than uploading statements — lenders accept it for asset verification.
        </p>
      </div>
      <PlaidConnectButton
        applicationId={applicationId}
        verificationType="assets"
        label="Connect with Plaid"
        testId="button-plaid-connect-inline"
      />
    </div>
  );
}
