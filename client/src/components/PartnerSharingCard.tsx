import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/errorMessage";
import { Home, ShieldCheck } from "lucide-react";

/**
 * Borrower-facing progress-sharing control (PH-2 of the PartnerHub program).
 *
 * Renders ONLY when the borrower was referred by a self-registering partner
 * (a realtor) — an LO referrer is the borrower's own loan team and gets no
 * toggle. Default OFF: until the borrower flips it on, their referring partner
 * sees only that they were invited, never their progress stage.
 *
 * The consent is borrower-directed and revocable here at any time. Shares
 * PROGRESS STAGES ONLY — never financials, documents, or amounts (charter
 * §5-C6). Copy is a conservative placeholder pending the counsel gate (§8).
 */

interface ReferringPartner {
  partner: { displayName: string; firmName: string; persona: string } | null;
  shared: boolean;
  grantedAt?: string | null;
}

export function PartnerSharingCard() {
  const { toast } = useToast();

  const { data } = useQuery<ReferringPartner>({
    queryKey: ["/api/me/referring-partner"],
  });

  const toggle = useMutation({
    mutationFn: async (share: boolean) => {
      const res = await apiRequest("PUT", "/api/me/referring-partner/consent", { share });
      return res.json();
    },
    onMutate: async (share: boolean) => {
      // Optimistic flip so the switch feels instant.
      await queryClient.cancelQueries({ queryKey: ["/api/me/referring-partner"] });
      const prev = queryClient.getQueryData<ReferringPartner>(["/api/me/referring-partner"]);
      if (prev) {
        queryClient.setQueryData<ReferringPartner>(["/api/me/referring-partner"], { ...prev, shared: share });
      }
      return { prev };
    },
    onError: (err: Error, _share, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/me/referring-partner"], ctx.prev);
      toast({
        title: "Couldn't update sharing",
        description: friendlyApiError(err, "Please try again."),
        variant: "destructive",
      });
    },
    onSuccess: (result: { shared: boolean }) => {
      toast({
        title: result.shared ? "Progress sharing on" : "Progress sharing off",
        description: result.shared
          ? `${data?.partner?.displayName ?? "Your agent"} can now see your progress stage.`
          : "Your agent no longer sees your progress.",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/referring-partner"] });
    },
  });

  // No referring partner → nothing to share; render nothing.
  if (!data?.partner) return null;

  const shared = data.shared;

  return (
    <Card data-testid="card-partner-sharing">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Home className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="partner-sharing-toggle" className="text-sm font-semibold">
                Share progress with {data.partner.displayName}
              </Label>
              <p className="text-sm text-muted-foreground" data-testid="text-partner-sharing-desc">
                {data.partner.displayName} at {data.partner.firmName} referred you. Turn this on to
                let them see your <span className="font-medium text-foreground">progress stage</span>{" "}
                (like "In review" or "Clear to close") — never your income, documents, or any
                financial details. You can turn it off anytime.
              </p>
            </div>
          </div>
          <Switch
            id="partner-sharing-toggle"
            checked={shared}
            onCheckedChange={(v) => toggle.mutate(v)}
            disabled={toggle.isPending}
            aria-label={`Share my progress with ${data.partner.displayName}`}
            data-testid="switch-partner-sharing"
          />
        </div>
        {shared && (
          <div
            className="mt-3 flex items-center gap-1.5 text-xs text-success-subtle-foreground"
            data-testid="text-sharing-on"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Sharing progress stage only — your financial details stay private.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
