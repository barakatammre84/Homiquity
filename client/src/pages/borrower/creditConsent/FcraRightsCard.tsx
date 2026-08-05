import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

/**
 * Standing FCRA rights summary, shown whether or not consent has been given.
 *
 * These four lines paraphrase rights the borrower already holds under 15
 * U.S.C. §1681 — free annual file disclosure (§1681j), dispute of inaccurate
 * information (§1681i), adverse-action notice (§1681m), and the mortgage
 * inquiry de-duplication window used by the scoring models. They are not the
 * disclosure the consent is recorded against; that text comes from the server
 * with a version stamp and is rendered by DisclosureCard.
 */
export function FcraRightsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Rights Under the FCRA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p>You have the right to obtain a free credit report annually from each bureau at annualcreditreport.com</p>
        </div>
        <div className="flex items-start gap-3">
          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p>You have the right to dispute any inaccurate information on your credit report</p>
        </div>
        <div className="flex items-start gap-3">
          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p>If we take adverse action based on your credit, you will receive a notice explaining why</p>
        </div>
        <div className="flex items-start gap-3">
          <ChevronRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p>Multiple mortgage inquiries within 45 days count as a single inquiry for scoring purposes</p>
        </div>
      </CardContent>
    </Card>
  );
}
