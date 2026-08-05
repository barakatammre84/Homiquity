import { AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AccessDeniedCard() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to access the staff dashboard.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * External partners (broker, lender) pass the page guard but the operations
 * dashboard is internal-staff only. Brokers are routed to /broker-dashboard;
 * lender is a deferred persona with no product surface yet — show a neutral
 * partner landing instead of an empty internal shell.
 */
export function PartnerWorkspaceCard({
  userRole,
  onGoToBrokerDashboard,
}: {
  userRole: string;
  onGoToBrokerDashboard: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="max-w-md">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Partner workspace</h2>
          <p className="text-muted-foreground mb-6">
            Your partner workspace is being set up. The operations dashboard is
            reserved for internal staff.
          </p>
          {userRole === "broker" && (
            <Button onClick={onGoToBrokerDashboard} data-testid="button-go-broker-dashboard">
              Go to Broker Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
