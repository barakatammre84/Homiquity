import { Card, CardContent } from "@/components/ui/card";
import { ReviewWorkbenchPanel } from "@/components/staff/ReviewWorkbenchPanel";
import { TaxIntelligencePanel } from "@/components/staff/TaxIntelligencePanel";

export function TaxIntelTab({
  borrowerUserId,
  applicationId,
}: {
  /** Null until the application query resolves — both panels key off it. */
  borrowerUserId: string | null | undefined;
  applicationId: string;
}) {
  if (!borrowerUserId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Borrower not loaded yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <ReviewWorkbenchPanel
        borrowerUserId={borrowerUserId}
        applicationId={applicationId}
      />
      <TaxIntelligencePanel
        borrowerUserId={borrowerUserId}
        applicationId={applicationId}
      />
    </>
  );
}
