import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SIGNAL_META, type CockpitData, type StaffSignal } from "./types";

// -----------------------------------------------------------------------------
// Call Prep — a one-screen digest for the phone call.
// -----------------------------------------------------------------------------
export function CallPrepDialog({
  applicationId,
  borrowerName,
  signals,
}: {
  applicationId: string;
  borrowerName: string;
  signals: StaffSignal[];
}) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<CockpitData>({
    queryKey: ["/api/staff/applications", applicationId, "cockpit"],
    enabled: open,
  });

  const openSignals = signals.filter((s) => s.applicationId === applicationId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="touch-target w-full justify-start" data-testid="action-call-prep">
          <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
          Call Prep
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto" data-testid="call-prep-dialog">
        <DialogHeader>
          <DialogTitle>Call Prep — {borrowerName}</DialogTitle>
          <DialogDescription>Everything to know before you dial, on one screen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="mb-1.5 text-sm font-semibold">What needs attention</h3>
            {openSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open signals — the file is quiet.</p>
            ) : (
              <ul className="space-y-1.5">
                {openSignals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant={SIGNAL_META[s.priority].badge}>{SIGNAL_META[s.priority].label}</Badge>
                    <span>
                      <span className="font-medium">{s.title}</span>
                      <span className="block text-muted-foreground">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Next conditions</h3>
            {!data ? (
              <Skeleton className="h-12" />
            ) : data.conditions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open conditions.</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {data.conditions.items.slice(0, 5).map((c) => (
                  <li key={c.id}>{c.title}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Recent borrower activity (7 days)</h3>
            {!data ? (
              <Skeleton className="h-8" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.activity.propertyViews} property views · {data.activity.propertySearches} searches ·{" "}
                {data.activity.calculatorUses} calculator uses
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
