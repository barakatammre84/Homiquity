import { ArrowRight, BadgeCheck, Building2, Clock, Home, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSpecialtyLabel, type AgentResult } from "./types";

export function AgentCard({
  agent,
  onRequestReferral,
}: {
  agent: AgentResult;
  onRequestReferral: (agentId: string) => void;
}) {
  const rating = agent.averageRating ? parseFloat(agent.averageRating) : 0;

  return (
    <Card className="p-5 hover-elevate transition-all" data-testid={`card-agent-${agent.id}`}>
      <div className="flex gap-4">
        <Avatar className="h-16 w-16 flex-shrink-0">
          <AvatarImage src={agent.photoUrl || undefined} alt={`${agent.firstName} ${agent.lastName}`} />
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
            {agent.firstName[0]}
            {agent.lastName?.[0] || ""}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="font-semibold text-foreground text-lg"
              data-testid={`text-agent-name-${agent.id}`}
            >
              {agent.firstName} {agent.lastName}
            </h3>
            {agent.isVerified && (
              <Badge variant="secondary" className="text-xs">
                <BadgeCheck className="w-3 h-3 mr-0.5" />
                Verified
              </Badge>
            )}
          </div>
          {agent.brokerage && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5" data-testid={`text-agent-brokerage-${agent.id}`}>
              <Building2 className="w-3 h-3" />
              {agent.brokerage}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {rating > 0 && (
              <div className="flex items-center gap-1 text-sm" data-testid={`text-agent-rating-${agent.id}`}>
                <Star className="w-3.5 h-3.5 fill-warning text-warning-subtle-foreground" />
                <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
                {(agent.totalReviews ?? 0) > 0 && (
                  <span className="text-muted-foreground">({agent.totalReviews} reviews)</span>
                )}
              </div>
            )}
            {(agent.propertiesSold ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-agent-sales-${agent.id}`}>
                <Home className="w-3.5 h-3.5" />
                {agent.propertiesSold} sold
              </div>
            )}
            {(agent.yearsInBusiness ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {agent.yearsInBusiness} years
              </div>
            )}
          </div>
        </div>
      </div>

      {agent.bio && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2" data-testid={`text-agent-bio-${agent.id}`}>
          {agent.bio}
        </p>
      )}

      {agent.specialties && agent.specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {agent.specialties.slice(0, 4).map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              {getSpecialtyLabel(s)}
            </Badge>
          ))}
          {agent.specialties.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{agent.specialties.length - 4} more
            </Badge>
          )}
        </div>
      )}

      {agent.serviceArea && agent.serviceArea.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <MapPin className="w-3 h-3" />
          <span>{agent.serviceArea.slice(0, 3).join(", ")}</span>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <Button
          className="flex-1"
          onClick={() => onRequestReferral(agent.id)}
          data-testid={`button-connect-${agent.id}`}
        >
          Connect with Agent
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
