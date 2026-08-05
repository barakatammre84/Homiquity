import { Building2, DollarSign, MapPin, Star, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DpaProgram } from "./types";

function ProgramTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {};
  const labels: Record<string, string> = {
    grant: "Grant",
    forgivable_loan: "Forgivable Loan",
    deferred_loan: "Deferred Loan",
    second_mortgage: "2nd Mortgage",
    matched_savings: "Matched Savings",
  };
  return <Badge variant="secondary" className={styles[type] || ""}>{labels[type] || type}</Badge>;
}

export function ProgramCard({ program }: { program: DpaProgram }) {
  return (
    <Card className="hover-elevate" data-testid={`card-program-${program.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-foreground">{program.name}</h3>
              <ProgramTypeBadge type={program.assistanceType} />
              <Badge variant="outline" className="text-[10px]">{program.programType}</Badge>
              {program.firstTimeBuyerOnly && (
                <Badge variant="outline" className="text-[10px] border-border/30 text-success-subtle-foreground">
                  <Users className="h-3 w-3 mr-0.5" /> First-Time Only
                </Badge>
              )}
            </div>
            {program.description && (
              <p className="text-xs text-muted-foreground mb-2">{program.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {(program.maxAssistancePercent || program.maxAssistanceAmount) && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Up to {program.maxAssistancePercent ? `${program.maxAssistancePercent}%` : `$${Number(program.maxAssistanceAmount).toLocaleString()}`}
                </span>
              )}
              {program.state ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {program.state}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Nationwide
                </span>
              )}
              {program.minCreditScore && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" /> Min {program.minCreditScore} credit
                </span>
              )}
              {program.maxIncome && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Income limit: ${Number(program.maxIncome).toLocaleString()}
                </span>
              )}
            </div>
            {program.eligibilityNotes && (
              <p className="text-[10px] text-muted-foreground mt-2 italic">{program.eligibilityNotes}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
