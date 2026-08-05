import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Clock, Lock, Save, Shield } from "lucide-react";
import { normalizeSsnLast4 } from "./types";

export interface AuthorizationFormProps {
  fullName: string;
  onFullNameChange: (v: string) => void;
  ssnLast4: string;
  onSsnLast4Change: (v: string) => void;
  dob: string;
  onDobChange: (v: string) => void;
  acknowledged: boolean;
  onAcknowledgedChange: (v: boolean) => void;
  submitting: boolean;
  saving: boolean;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
}

/**
 * The FCRA authorization form. Presentational only — the submit and save-draft
 * mutations stay in CreditConsent.tsx, where the consent record is written.
 *
 * The SSN field is deliberately last-four-only and optional; the whisper text
 * under it says so, and the input strips anything that is not a digit so a
 * full SSN cannot be pasted in.
 */
export function AuthorizationForm({
  fullName,
  onFullNameChange,
  ssnLast4,
  onSsnLast4Change,
  dob,
  onDobChange,
  acknowledged,
  onAcknowledgedChange,
  submitting,
  saving,
  onSubmit,
  onSaveDraft,
  onCancel,
}: AuthorizationFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Your Authorization
        </CardTitle>
        <CardDescription>
          Provide your information to authorize the credit check
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="fullName">Full Legal Name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              placeholder="Enter your full legal name as it appears on your ID"
              data-testid="input-full-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssnLast4">Last 4 of SSN (optional)</Label>
            <Input
              id="ssnLast4"
              value={ssnLast4}
              onChange={(e) => onSsnLast4Change(normalizeSsnLast4(e.target.value))}
              placeholder="1234"
              maxLength={4}
              data-testid="input-ssn-last4"
            />
            <p className="text-xs text-muted-foreground" data-testid="text-ssn-whisper">
              Used only to match you with your credit report — we never ask for your full
              SSN here, and sharing it is optional.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth (optional)</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => onDobChange(e.target.value)}
              data-testid="input-dob"
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-start gap-3">
          <Checkbox
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => onAcknowledgedChange(checked as boolean)}
            data-testid="checkbox-acknowledge"
          />
          <Label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
            I have read and understand the Credit Authorization Disclosure above. I authorize
            Homiquity to obtain my credit report from one or more consumer reporting agencies
            for the purpose of evaluating my mortgage loan application.
          </Label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onSubmit}
            disabled={!fullName || !acknowledged || submitting}
            className="flex-1"
            data-testid="button-authorize-credit"
          >
            {submitting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                I Authorize Credit Check
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            disabled={saving}
            data-testid="button-save-progress"
          >
            {saving ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Progress
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By clicking "I Authorize", you are providing written authorization as required by the
          Fair Credit Reporting Act (FCRA). This authorization is valid for 120 days.
        </p>
      </CardContent>
    </Card>
  );
}
