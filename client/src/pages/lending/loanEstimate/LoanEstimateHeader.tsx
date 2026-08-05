import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";

/**
 * Page chrome above the disclosure.
 *
 * KNOWN GAP. Print and Download PDF are inert — neither has ever had a click
 * handler. Both need work outside this component to fix honestly:
 *
 *  - Print: the disclosure body lives inside a fixed-height Radix ScrollArea,
 *    so window.print() on its own would emit only the visible viewport. A
 *    truncated Loan Estimate is a worse artefact than no printout, so wiring
 *    the handler means adding print styles that release the scroll container
 *    and hide this bar first.
 *  - Download PDF: there is no PDF endpoint. The only Loan Estimate route is
 *    GET /api/loan-applications/:id/loan-estimate (server/routes/underwriting/
 *    delivery.ts), which returns JSON.
 *
 * Left inert and documented rather than half-wired, because the card below
 * tells the borrower to "Save this Loan Estimate to compare with your Closing
 * Disclosure" — a button that produces a clipped disclosure would be worse
 * than one that visibly does nothing.
 */
export function LoanEstimateHeader({ applicationId }: { applicationId: string | undefined }) {
  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Back" asChild>
          <Link href={`/borrower-file/${applicationId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Loan Estimate
          </h1>
          <p className="text-sm text-muted-foreground">
            TRID-Compliant Disclosure Document
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" data-testid="button-print">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button size="sm" data-testid="button-download">
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
