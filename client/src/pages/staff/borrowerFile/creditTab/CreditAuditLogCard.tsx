import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileWarning } from "lucide-react";
import { format } from "date-fns";
import type { CreditAuditEntry } from "../model";

/** Append-only record of credit actions, retained for FCRA compliance. */
export function CreditAuditLogCard({ entries }: { entries: CreditAuditEntry[] | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Credit Audit Log
        </CardTitle>
        <CardDescription>
          Immutable record of all credit-related actions for FCRA compliance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          {entries && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {entry.action.replace(/_/g, " ")}
                    </p>
                    {entry.actionDetails && (
                      <p className="text-xs text-muted-foreground">
                        {JSON.stringify(entry.actionDetails)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No credit activity recorded yet.
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
