import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertOctagon, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import type { CreditSummary } from "../model";

export interface NoticeDeliveryState {
  open: boolean;
  method: string;
  confirmation: string;
}

/**
 * Adverse-action notices and the ECOA/Reg B §1002.9 postal-fallback flow:
 * download the notice as a mailable PDF, send it, then confirm delivery with
 * the method used.
 *
 * The confirmation goes through a dialog on purpose. Marking a notice
 * delivered records the §1002.9 notification obligation as met and there is no
 * undo endpoint, so it must not be a single stray click. Both the download and
 * the confirmation are driven by handlers from CreditTab, which owns the
 * mutation.
 */
export function AdverseActionCard({
  creditData,
  noticeDelivery,
  setNoticeDelivery,
  downloadingNotice,
  onDownload,
  onConfirmDelivery,
  isConfirming,
}: {
  creditData: CreditSummary;
  noticeDelivery: NoticeDeliveryState;
  setNoticeDelivery: React.Dispatch<React.SetStateAction<NoticeDeliveryState>>;
  downloadingNotice: boolean;
  onDownload: (adverseActionId: string) => void;
  onConfirmDelivery: (adverseActionId: string, method: string, confirmation?: string) => void;
  isConfirming: boolean;
}) {
  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertOctagon className="h-5 w-5" />
          Adverse Action Notices ({creditData.adverseActionCount})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {creditData.latestAdverseAction && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium capitalize">
                {creditData.latestAdverseAction.actionType.replace(/_/g, " ")}
              </span>
              <Badge variant={creditData.latestAdverseAction.deliveredAt ? "default" : "secondary"}>
                {creditData.latestAdverseAction.deliveredAt ? "Delivered" : "Pending Delivery"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {creditData.latestAdverseAction.primaryReason}
            </p>
            <p className="text-xs text-muted-foreground">
              Generated: {format(new Date(creditData.latestAdverseAction.noticeDate), "MMM d, yyyy")}
            </p>
            {creditData.latestAdverseAction.deliveredAt ? (
              <p className="text-xs text-muted-foreground" data-testid="text-notice-delivered">
                Delivered
                {creditData.latestAdverseAction.deliveryMethod
                  ? ` via ${creditData.latestAdverseAction.deliveryMethod.replace(/_/g, "-")}`
                  : ""}
                : {format(new Date(creditData.latestAdverseAction.deliveredAt), "MMM d, yyyy")}
              </p>
            ) : (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Reg B §1002.9 requires the applicant be notified within 30 days of the
                  decision. If the borrower hasn't seen the in-app notice, download the
                  letter, mail it, then confirm delivery here.
                </p>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(creditData.latestAdverseAction!.id)}
                disabled={downloadingNotice}
                data-testid="button-download-adverse-action-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingNotice ? "Preparing…" : "Download for mailing"}
              </Button>
              {!creditData.latestAdverseAction.deliveredAt && (
                <Dialog
                  open={noticeDelivery.open}
                  onOpenChange={(o) => setNoticeDelivery(prev => ({ ...prev, open: o }))}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-confirm-notice-delivery">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm delivery
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm notice delivery</DialogTitle>
                      <DialogDescription>
                        This records the adverse-action notice as delivered, satisfying the
                        Reg B §1002.9 notification requirement. It cannot be undone — confirm
                        only after the notice has actually been sent to the borrower.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Delivery method</Label>
                        <Select
                          value={noticeDelivery.method}
                          onValueChange={(v) => setNoticeDelivery(prev => ({ ...prev, method: v }))}
                        >
                          <SelectTrigger data-testid="select-notice-delivery-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mail">Mail</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="in_app">In-app</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Delivery confirmation (optional)</Label>
                        <Input
                          value={noticeDelivery.confirmation}
                          onChange={(e) => setNoticeDelivery(prev => ({ ...prev, confirmation: e.target.value }))}
                          placeholder="e.g., certified-mail tracking number"
                          maxLength={255}
                          data-testid="input-notice-delivery-confirmation"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setNoticeDelivery({ open: false, method: "mail", confirmation: "" })}
                        data-testid="button-cancel-notice-delivery"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          onConfirmDelivery(
                            creditData.latestAdverseAction!.id,
                            noticeDelivery.method,
                            noticeDelivery.confirmation.trim() || undefined,
                          )
                        }
                        disabled={isConfirming}
                        data-testid="button-confirm-notice-delivery-submit"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {isConfirming ? "Confirming…" : "Confirm delivery"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
