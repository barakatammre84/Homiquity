import { useState } from "react";
import { friendlyApiError } from "@/lib/errorMessage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { useToast } from "@/hooks/use-toast";
import { type CreditSummary, type CreditAuditEntry } from "./model";
import { PreApprovalLetterCard } from "./PreApprovalLetterCard";
import { ConsentStatusCard, CreditReportCard } from "./creditTab/ConsentAndReportCards";
import { AdverseActionCard, type NoticeDeliveryState } from "./creditTab/AdverseActionCard";
import { CreditAuditLogCard } from "./creditTab/CreditAuditLogCard";

/**
 * Credit tab (extracted from BorrowerFile.tsx): FCRA consent status, tri-merge
 * pull, the file's pre-approval letter (with the CREDIT_DECISION_ROLES-gated
 * revocation action), adverse-action notices with the ECOA/Reg B §1002.9
 * postal-fallback delivery flow (download PDF → mail → confirm; no undo
 * endpoint), and the immutable credit audit log. Owns its own queries and
 * mutations — the parent supplies the application id and the role gate.
 */
export function CreditTab({
  applicationId,
  canRevokeLetter,
}: {
  applicationId: string;
  canRevokeLetter: boolean;
}) {
  const { toast } = useToast();

  const { data: creditData, isLoading: creditLoading } = useQuery<CreditSummary>({
    queryKey: loanApplicationKeys.credit.summary(applicationId),
    enabled: !!applicationId,
  });

  const { data: auditLog } = useQuery<{ auditLog: CreditAuditEntry[] }>({
    queryKey: loanApplicationKeys.credit.auditLog(applicationId),
    enabled: !!applicationId,
  });

  const pullCreditMutation = useMutation({
    mutationFn: async (pullType: string) => {
      const response = await apiRequest("POST", `/api/loan-applications/${applicationId}/credit/pull`, {
        pullType,
        bureaus: ["experian", "equifax", "transunion"],
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.summary(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.auditLog(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      toast({
        title: "Credit Pull Complete",
        description: "Credit report has been successfully retrieved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Credit Pull Failed",
        description: error.message || "Failed to pull credit report",
        variant: "destructive",
      });
    },
  });

  // Postal fallback for the ECOA/Reg B delivery window: download the notice as
  // a mailable PDF, send it, then confirm delivery with the method used.
  // Confirmation goes through a dialog: marking a notice delivered records the
  // Reg B §1002.9 obligation as met and there is no undo endpoint.
  const [noticeDelivery, setNoticeDelivery] = useState<NoticeDeliveryState>({
    open: false,
    method: "mail",
    confirmation: "",
  });
  const [downloadingNotice, setDownloadingNotice] = useState(false);

  const handleDownloadAdverseActionPdf = async (adverseActionId: string) => {
    setDownloadingNotice(true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/credit/adverse-action/${adverseActionId}/letter-pdf`,
      ).catch((err: unknown) => {
        throw new Error(friendlyApiError(err, "Failed to generate the notice PDF."));
      });
      await downloadResponseAsFile(res, `adverse-action-${adverseActionId.substring(0, 8)}.pdf`);
      toast({
        title: "Notice Downloaded",
        description: "Print and mail the letter, then confirm delivery below.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setDownloadingNotice(false);
    }
  };

  const confirmNoticeDeliveryMutation = useMutation({
    mutationFn: async ({ adverseActionId, method, confirmation }: { adverseActionId: string; method: string; confirmation?: string }) => {
      return apiRequest("POST", `/api/credit/adverse-action/${adverseActionId}/deliver`, {
        deliveryMethod: method,
        deliveryConfirmation: confirmation || undefined,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.summary(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.credit.auditLog(applicationId) });
      setNoticeDelivery({ open: false, method: "mail", confirmation: "" });
      toast({
        title: "Delivery Confirmed",
        description: `Adverse-action notice recorded as delivered via ${variables.method.replace(/_/g, "-")}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delivery Confirmation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <ConsentStatusCard
          creditData={creditData}
          creditLoading={creditLoading}
          applicationId={applicationId}
        />
        <CreditReportCard
          creditData={creditData}
          isPulling={pullCreditMutation.isPending}
          onPull={() => pullCreditMutation.mutate("tri_merge")}
        />
      </div>

      <PreApprovalLetterCard applicationId={applicationId} canRevoke={canRevokeLetter} />

      {/* Compared, not truthy-tested: `count && ...` yields the number 0 when
          there are no notices, and React renders a literal "0" on the tab. */}
      {(creditData?.adverseActionCount ?? 0) > 0 && creditData && (
        <AdverseActionCard
          creditData={creditData}
          noticeDelivery={noticeDelivery}
          setNoticeDelivery={setNoticeDelivery}
          downloadingNotice={downloadingNotice}
          onDownload={handleDownloadAdverseActionPdf}
          onConfirmDelivery={(adverseActionId, method, confirmation) =>
            confirmNoticeDeliveryMutation.mutate({ adverseActionId, method, confirmation })
          }
          isConfirming={confirmNoticeDeliveryMutation.isPending}
        />
      )}

      <CreditAuditLogCard entries={auditLog?.auditLog} />
    </>
  );
}
