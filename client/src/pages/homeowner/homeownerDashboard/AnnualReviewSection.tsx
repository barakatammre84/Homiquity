import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { HomeownerProfile } from "./types";

export function AnnualReviewSection({ profile }: { profile: HomeownerProfile }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const scheduleMutation = useMutation({
    mutationFn: () => {
      const nextDate = new Date();
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      return apiRequest("PUT", `/api/homeowner/profile/${profile.id}`, {
        nextReviewDate: nextDate.toISOString().split("T")[0],
        lastReviewDate: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Review Scheduled", description: "Your annual review has been scheduled." });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule review.", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-annual-review">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Annual Review
        </CardTitle>
        <CardDescription>Stay on top of your mortgage health with annual check-ins</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Next Review</p>
            <p className="text-sm font-semibold text-foreground" data-testid="text-next-review">
              {profile.nextReviewDate
                ? format(new Date(profile.nextReviewDate), "MMMM d, yyyy")
                : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Review</p>
            <p className="text-sm font-semibold text-foreground" data-testid="text-last-review">
              {profile.lastReviewDate
                ? format(new Date(profile.lastReviewDate), "MMMM d, yyyy")
                : "Never"}
            </p>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending}
              data-testid="button-schedule-review"
            >
              <Calendar className="h-4 w-4 mr-1" />
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Review"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
