import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { formatDate } from "@/lib/formatters";
import {
  selectBorrowerLetterState,
  canDownloadLetter,
  canRequestLetter,
  describeUnusableLetter,
  type LetterStatusResponse,
} from "@/lib/letterStatus";
import { PREQUAL_ELIGIBLE_STATUSES } from "@shared/letters";

// Pre-qual and pre-approval letters are the same interaction — check whether a
// letter exists, generate it if not, download it once it does — differing only
// in endpoints, copy, and which loan statuses they apply to. They were two
// near-identical 65-line components; this is the shared shape, with the
// per-letter differences declared in LETTER_KINDS below.
type LetterKind = {
  /** Which loan statuses this letter is offered for. */
  isEligible: (status: string) => boolean;
  statusQueryKey: (applicationId: string) => readonly unknown[];
  generatePath: (applicationId: string) => string;
  pdfPath: (applicationId: string) => string;
  downloadFileName: string;
  generatedToastTitle: string;
  generatedToastDescription: (letterNumber: string) => string;
  errorToastDescription: string;
  generateLabel: string;
  /** Label when a letter already existed but has expired — this is a reissue, not a first issue. */
  reissueLabel: string;
  downloadLabel: string;
  generateVariant?: "outline";
  generateTestId: string;
  downloadTestId: string;
};

const LETTER_KINDS = {
  prequal: {
    // Offered while the file is pre-qual eligible, but a pre-approved file gets
    // the stronger pre-approval letter instead.
    isEligible: (status) =>
      (PREQUAL_ELIGIBLE_STATUSES as readonly string[]).includes(status) && status !== "pre_approved",
    statusQueryKey: (id) => loanApplicationKeys.prequalStatus(id),
    generatePath: (id) => `/api/loan-applications/${id}/generate-prequal`,
    pdfPath: (id) => `/api/loan-applications/${id}/prequal-pdf`,
    downloadFileName: "pre-qualification-letter.pdf",
    generatedToastTitle: "Letter Generated",
    generatedToastDescription: (n) => `Pre-qualification letter #${n} is ready.`,
    errorToastDescription: "Failed to generate pre-qualification letter.",
    generateLabel: "Get Pre-Qualification Letter",
    reissueLabel: "Get an Updated Pre-Qualification Letter",
    downloadLabel: "Download Pre-Qualification Letter",
    generateVariant: "outline",
    generateTestId: "button-generate-prequal",
    downloadTestId: "button-download-prequal",
  },
  preapproval: {
    isEligible: (status) => status === "pre_approved",
    statusQueryKey: (id) => loanApplicationKeys.letterStatus(id),
    generatePath: (id) => `/api/loan-applications/${id}/generate-letter`,
    pdfPath: (id) => `/api/loan-applications/${id}/letter-pdf`,
    downloadFileName: "pre-approval-letter.pdf",
    generatedToastTitle: "Letter Generated",
    generatedToastDescription: (n) => `Pre-approval letter #${n} is ready.`,
    errorToastDescription: "Failed to generate letter. Please try again.",
    generateLabel: "Generate Pre-Approval Letter",
    reissueLabel: "Get an Updated Pre-Approval Letter",
    downloadLabel: "Download Pre-Approval Letter",
    generateTestId: "button-generate-letter",
    downloadTestId: "button-download-letter",
  },
} satisfies Record<string, LetterKind>;

export function LoanLetterButton({
  applicationId,
  status,
  kind,
}: {
  applicationId: string;
  status: string;
  kind: keyof typeof LETTER_KINDS;
}) {
  const queryClient = useQueryClient();
  const spec: LetterKind = LETTER_KINDS[kind];
  const { toast } = useToast();

  const statusQuery = useQuery<LetterStatusResponse>({
    queryKey: spec.statusQueryKey(applicationId),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", spec.generatePath(applicationId));
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({
        title: spec.generatedToastTitle,
        description: spec.generatedToastDescription(data.letterNumber),
      });
      queryClient.invalidateQueries({ queryKey: spec.statusQueryKey(applicationId) });
    },
    onError: () => {
      toast({ title: "Error", description: spec.errorToastDescription, variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await apiRequest("GET", spec.pdfPath(applicationId));
      await downloadResponseAsFile(res, spec.downloadFileName);
    } catch {
      toast({ title: "Error", description: "Failed to download letter.", variant: "destructive" });
    }
  };

  if (!spec.isEligible(status)) return null;

  // One selector, shared with the two dashboard letter cards: an expired or
  // revoked letter may never render as "ready to download", and a revoked one
  // may never be re-minted by the borrower (lib/letterStatus.ts).
  const letterState = selectBorrowerLetterState(statusQuery.data, statusQuery.isError);
  const unusable = describeUnusableLetter(letterState, formatDate);

  return (
    <>
      {unusable && (
        <p className="text-sm text-muted-foreground" data-testid="text-letter-unusable">
          {unusable}
        </p>
      )}
      {canRequestLetter(letterState) && (
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          variant={spec.generateVariant}
          className="gap-2"
          data-testid={spec.generateTestId}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {generateMutation.isPending
            ? "Generating..."
            : letterState.kind === "expired"
              ? spec.reissueLabel
              : spec.generateLabel}
        </Button>
      )}
      {canDownloadLetter(letterState) && (
        <Button onClick={handleDownload} variant="outline" className="gap-2" data-testid={spec.downloadTestId}>
          <Download className="h-4 w-4" />
          {spec.downloadLabel}
        </Button>
      )}
    </>
  );
}
