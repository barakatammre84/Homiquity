import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { formatRate } from "./offerMath";
import type { BorrowerOffer } from "./types";

export interface ConfirmSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: BorrowerOffer | null;
  attestationChecked: boolean;
  onAttestationChange: (checked: boolean) => void;
  onConfirm: () => void;
}

/**
 * Selection confirmation. The checkbox is the anti-steering attestation — the
 * borrower affirms they reviewed multiple options and that their financial
 * information is unchanged — and it gates the confirm button, so the wording
 * and the gating move together.
 */
export function ConfirmSelectionDialog({
  open,
  onOpenChange,
  offer,
  attestationChecked,
  onAttestationChange,
  onConfirm,
}: ConfirmSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-confirm-selection">
        <DialogHeader>
          <DialogTitle>Confirm Your Selection</DialogTitle>
          <DialogDescription>
            Please review your selected option before proceeding.
          </DialogDescription>
        </DialogHeader>
        {offer && (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="mb-3 font-medium" data-testid="text-confirm-option-label">
                {offer.optionLabel} — {offer.productName}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Interest Rate</p>
                  <p className="font-bold text-lg">{formatRate(offer.rate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly Payment</p>
                  <p className="font-bold text-lg">{formatCurrency(offer.monthlyPayment)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cash to Close</p>
                  <p className="font-medium">{formatCurrency(offer.cashToClose)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lock Term</p>
                  <p className="font-medium">{offer.lockTerm} days</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <Checkbox
                id="attestation"
                checked={attestationChecked}
                onCheckedChange={(checked) => onAttestationChange(checked === true)}
                data-testid="checkbox-attestation"
              />
              <Label htmlFor="attestation" className="text-sm leading-relaxed cursor-pointer">
                I understand I reviewed multiple options and selected this one. I confirm that my financial information has not changed since my application.
              </Label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-selection">
            Go Back
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!attestationChecked}
            data-testid="button-confirm-selection"
          >
            <Check className="h-4 w-4 mr-2" />
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
