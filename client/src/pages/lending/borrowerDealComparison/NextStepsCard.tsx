import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NextStepsCard() {
  return (
    <Card className="mt-6 border-primary" data-testid="card-next-steps">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          What Happens Next
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">1</div>
            <div>
              <p className="font-medium">Lock Confirmation</p>
              <p className="text-sm text-muted-foreground">Your broker will confirm your rate lock with the lender.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">2</div>
            <div>
              <p className="font-medium">Loan Estimate</p>
              <p className="text-sm text-muted-foreground">You'll receive an official Loan Estimate within 3 business days.</p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-medium">3</div>
            <div>
              <p className="font-medium">Document Collection</p>
              <p className="text-sm text-muted-foreground">We'll guide you through providing any additional documents needed.</p>
            </div>
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
