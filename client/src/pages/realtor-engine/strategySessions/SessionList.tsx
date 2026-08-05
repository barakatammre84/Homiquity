import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SessionCard } from "./SessionCard";
import type { StrategySession } from "./types";

export interface SessionListProps {
  sessions: StrategySession[];
  onComplete: (session: StrategySession) => void;
  onCancel: (id: string) => void;
  onAddNotes: (session: StrategySession) => void;
  empty: {
    testId: string;
    icon: LucideIcon;
    title: string;
    body: string;
  };
}

/**
 * A tab's session list, or its empty state.
 *
 * Sessions arrive already ordered from partitionSessions — upcoming ascending,
 * archive descending — so this component never re-sorts.
 */
export function SessionList({ sessions, onComplete, onCancel, onAddNotes, empty }: SessionListProps) {
  if (sessions.length === 0) {
    const Icon = empty.icon;
    return (
      <Card data-testid={empty.testId}>
        <CardContent className="py-8 text-center">
          <Icon className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">{empty.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{empty.body}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onComplete={onComplete}
          onCancel={onCancel}
          onAddNotes={onAddNotes}
        />
      ))}
    </div>
  );
}
