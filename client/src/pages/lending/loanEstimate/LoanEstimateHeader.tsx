import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { friendlyApiError } from "@/lib/errorMessage";
import { useToast } from "@/hooks/use-toast";

/**
 * Page chrome above the disclosure.
 *
 * Both actions were inert for the life of the page. They are wired now:
 *
 *  - Print calls window.print(). On its own that would have emitted only the
 *    visible viewport, because the disclosure body sits inside a fixed-height
 *    Radix ScrollArea — a clipped Loan Estimate, which is worse than none. The
 *    print rules in index.css release the scroll container and hide this bar,
 *    so the whole document paginates.
 *  - Download PDF fetches GET /api/loan-applications/:id/loan-estimate/pdf,
 *    which renders the disclosure in force (the issued baseline when one
 *    exists) behind the same e_disclosure consent gate as the page itself.
 *
 * The bar carries `print:hidden`: the buttons must not appear on the printed
 * disclosure.
 */
export function LoanEstimateHeader({ applicationId }: { applicationId: string | undefined }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!applicationId) return;
    setDownloading(true);
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/loan-estimate/pdf`)
        .catch((err: unknown) => {
          throw new Error(friendlyApiError(err, "Failed to generate the Loan Estimate PDF."));
        });
      await downloadResponseAsFile(res, `loan-estimate-${applicationId.substring(0, 8)}.pdf`);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-3 print:hidden">
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
        <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button size="sm" onClick={handleDownload} disabled={downloading || !applicationId} data-testid="button-download">
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Preparing…" : "Download PDF"}
        </Button>
      </div>
    </div>
  );
}
