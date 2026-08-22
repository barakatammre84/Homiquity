import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LENDER_APPROVAL_STATUSES, type LenderApprovalStatus } from "@shared/wholesaleLenders";
import { DEFAULT_EPO_CLAWBACK_DAYS } from "@shared/compensationClawback";

/**
 * Admin counterparties — the go-live data-entry surface for wholesale lenders.
 *
 * Everything the platform can earn runs through a signed broker agreement, and
 * until this page existed the columns recording one had NO user interface at
 * all: `POST`/`PATCH /api/wholesale-lenders` had zero client callers, and the
 * audited approval endpoint (F-22) was reachable only by hand. Onboarding a
 * real lender at go-live meant writing to the database directly, which is
 * exactly how an unaudited authorization change happens.
 *
 * Three rules the page is built around, none of them cosmetic:
 *
 *  1. APPROVAL IS EVIDENCE, NOT A TOGGLE. The approve dialog asks for the
 *     broker-agreement reference and the contracted EPO window because the
 *     server requires them — approval asserts that an executed agreement
 *     exists, and the reserve must rest on its real term rather than on
 *     DEFAULT_EPO_CLAWBACK_DAYS.
 *  2. APPROVED-LENDER COUNT IS THE HEADLINE. It is the binding constraint on
 *     revenue (audit F-5): at zero, production submissions are blocked and no
 *     rate lock can be a real commitment (F-20). That belongs at the top of
 *     the page, not buried in a column.
 *  3. A DEMO ROW CAN NEVER BE APPROVED. The seeded sample counterparties exist
 *     so pricing has something to quote; the server refuses to approve one and
 *     the page does not offer it.
 */

interface WholesaleLenderRow {
  id: string;
  lenderId: string;
  lenderName: string;
  lenderCode: string;
  approvalStatus: string;
  isDemo: boolean;
  status: string | null;
  epoClawbackDays: number | null;
  primaryContact: string | null;
  contactEmail: string | null;
  portalUrl: string | null;
  specialty: string | null;
  brokerCompensation: {
    compensationType: "BORROWER_PAID" | "LENDER_PAID" | "EITHER";
    defaultBps?: number;
    minBps?: number;
    maxBps?: number;
  } | null;
}

const APPROVAL_LABEL: Record<LenderApprovalStatus, string> = {
  target: "Target",
  application_in_progress: "Application in progress",
  approved: "Approved",
  inactive: "Inactive",
};

const APPROVAL_VARIANT: Record<LenderApprovalStatus, "success" | "warning" | "secondary"> = {
  target: "secondary",
  application_in_progress: "warning",
  approved: "success",
  inactive: "secondary",
};

function approvalOf(row: WholesaleLenderRow): LenderApprovalStatus {
  // Unrecognised values fail closed to "target", mirroring toCounterparty() on
  // the server so the page can never render a typo as approved.
  return (LENDER_APPROVAL_STATUSES as string[]).includes(row.approvalStatus)
    ? (row.approvalStatus as LenderApprovalStatus)
    : "target";
}

export default function AdminLenders() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: lenders, isLoading } = useQuery<WholesaleLenderRow[]>({
    queryKey: ["/api/wholesale-lenders"],
  });

  const [approvalTarget, setApprovalTarget] = useState<WholesaleLenderRow | null>(null);
  const [termsTarget, setTermsTarget] = useState<WholesaleLenderRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const approvedCount = useMemo(
    () => (lenders ?? []).filter(l => approvalOf(l) === "approved" && !l.isDemo).length,
    [lenders],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/wholesale-lenders"] });
    // The approved count and the clawback reserve are both derived from these
    // rows, so the financial surfaces are stale the moment one changes.
    queryClient.invalidateQueries({ queryKey: ["/api/reports/compensation"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/contingent-liabilities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  };

  const onError = (error: unknown) =>
    toast({
      title: "Change refused",
      description: error instanceof Error ? error.message : "The server refused the change.",
      variant: "destructive",
    });

  return (
    <div className="space-y-6 p-6" data-testid="page-admin-lenders">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Counterparties</h1>
          <p className="text-sm text-muted-foreground">
            Wholesale lenders and the broker agreements behind them. Approval authorises
            transmitting a borrower&apos;s file to a third party, so it is recorded with its
            evidence rather than toggled.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-add-lender">
          Add lender
        </Button>
      </div>

      {/* Rule 2: the binding constraint goes first. */}
      <Alert
        variant={approvedCount === 0 ? "destructive" : "default"}
        data-testid="alert-approved-count"
      >
        <AlertDescription>
          {approvedCount === 0 ? (
            <>
              <strong>No approved counterparty.</strong> Production submissions are blocked, no rate
              lock can be a real commitment, and revenue capacity is zero until at least one broker
              agreement is executed and recorded here. Three approved lenders is the target for
              genuine best-execution.
            </>
          ) : (
            <>
              <strong>
                {approvedCount} approved counterpart{approvedCount === 1 ? "y" : "ies"}.
              </strong>{" "}
              {approvedCount < 3
                ? "Below the three-lender target for best execution — a single-creditor option set also weakens the anti-steering safe harbour."
                : "At or above the three-lender best-execution target."}
            </>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Wholesale lenders</CardTitle>
          <CardDescription>
            &quot;Status&quot; is row liveness. &quot;Approval&quot; is the record of a signed
            broker agreement — only it gates submission.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" data-testid="skeleton-lenders" />
          ) : !lenders || lenders.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-lenders">
              No wholesale lenders yet. Add the first counterparty to begin onboarding.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lender</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>EPO window</TableHead>
                  <TableHead>Compensation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lenders.map(lender => {
                  const approval = approvalOf(lender);
                  return (
                    <TableRow key={lender.id} data-testid={`row-lender-${lender.lenderId}`}>
                      <TableCell>
                        <div className="font-medium">{lender.lenderName}</div>
                        <div className="text-xs text-muted-foreground">
                          {lender.lenderId} · {lender.lenderCode}
                        </div>
                        {lender.isDemo && (
                          <Badge variant="warning" className="mt-1" data-testid={`badge-demo-${lender.lenderId}`}>
                            Demo — not a real company
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={APPROVAL_VARIANT[approval]}
                          data-testid={`badge-approval-${lender.lenderId}`}
                        >
                          {APPROVAL_LABEL[approval]}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-epo-${lender.lenderId}`}>
                        {lender.epoClawbackDays ? (
                          <span>{lender.epoClawbackDays} days</span>
                        ) : (
                          // Never render this as a number: an assumed window
                          // that looks contracted is how a reserve figure
                          // silently rests on a guess.
                          <span className="text-muted-foreground">
                            Not on record — reserve assumes {DEFAULT_EPO_CLAWBACK_DAYS} days
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lender.brokerCompensation ? (
                          <>
                            {lender.brokerCompensation.compensationType.replace("_", " ")}
                            {lender.brokerCompensation.defaultBps !== undefined && (
                              <span className="text-muted-foreground">
                                {" "}
                                · {lender.brokerCompensation.defaultBps} bps
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button
                          size="sm" className="touch-target"
                          variant="outline"
                          onClick={() => setApprovalTarget(lender)}
                          // Rule 3: a fictional company is never approvable, so
                          // the action is not offered rather than offered and
                          // refused.
                          disabled={lender.isDemo}
                          data-testid={`button-approval-${lender.lenderId}`}
                        >
                          Approval
                        </Button>
                        <Button
                          size="sm" className="touch-target"
                          variant="ghost"
                          onClick={() => setTermsTarget(lender)}
                          disabled={approval !== "approved"}
                          data-testid={`button-terms-${lender.lenderId}`}
                        >
                          Terms
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {approvalTarget && (
        <ApprovalDialog
          lender={approvalTarget}
          onClose={() => setApprovalTarget(null)}
          onSaved={() => {
            invalidate();
            setApprovalTarget(null);
            toast({ title: "Approval recorded" });
          }}
          onError={onError}
        />
      )}
      {termsTarget && (
        <ContractTermsDialog
          lender={termsTarget}
          onClose={() => setTermsTarget(null)}
          onSaved={() => {
            invalidate();
            setTermsTarget(null);
            toast({ title: "Contract terms updated" });
          }}
          onError={onError}
        />
      )}
      {createOpen && (
        <CreateLenderDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            invalidate();
            setCreateOpen(false);
            toast({
              title: "Lender added",
              description: "It starts as a target. Record the broker agreement to approve it.",
            });
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval — the audited authorization change (F-22)
// ---------------------------------------------------------------------------

function ApprovalDialog({
  lender, onClose, onSaved, onError,
}: {
  lender: WholesaleLenderRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [approvalStatus, setApprovalStatus] = useState<LenderApprovalStatus>(approvalOf(lender));
  const [reason, setReason] = useState("");
  const [agreementRef, setAgreementRef] = useState("");
  const [epoDays, setEpoDays] = useState(
    lender.epoClawbackDays ? String(lender.epoClawbackDays) : "",
  );

  const approving = approvalStatus === "approved";

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/wholesale-lenders/${lender.id}/approval`, {
        approvalStatus,
        reason,
        ...(approving ? { brokerAgreementReference: agreementRef } : {}),
        ...(approving ? { epoClawbackDays: Number(epoDays) } : {}),
      }),
    onSuccess: onSaved,
    onError,
  });

  // Mirrors the server's two refinements rather than trusting them to fire:
  // the dialog should not let a submit be built that the route will reject.
  const canSave =
    reason.trim().length > 0 &&
    (!approving || (agreementRef.trim().length > 0 && Number(epoDays) > 0));

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid="dialog-approval">
        <DialogHeader>
          <DialogTitle>Approval — {lender.lenderName}</DialogTitle>
          <DialogDescription>
            Approving asserts that an executed broker agreement exists. The change is audited with
            its previous and next values, the reason, and the agreement reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="approval-status">Approval status</Label>
            <Select
              value={approvalStatus}
              onValueChange={v => setApprovalStatus(v as LenderApprovalStatus)}
            >
              <SelectTrigger id="approval-status" data-testid="select-approval-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENDER_APPROVAL_STATUSES.map(status => (
                  <SelectItem key={status} value={status} data-testid={`option-approval-${status}`}>
                    {APPROVAL_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {approving && (
            <>
              <div className="space-y-2">
                <Label htmlFor="agreement-ref">Broker agreement reference</Label>
                <Input
                  id="agreement-ref"
                  value={agreementRef}
                  onChange={e => setAgreementRef(e.target.value)}
                  placeholder="e.g. UWM-BA-2026-0142"
                  data-testid="input-agreement-ref"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epo-days">Contracted EPO clawback window (days)</Label>
                <Input
                  id="epo-days"
                  type="number"
                  min={1}
                  value={epoDays}
                  onChange={e => setEpoDays(e.target.value)}
                  placeholder={String(DEFAULT_EPO_CLAWBACK_DAYS)}
                  data-testid="input-epo-days"
                />
                <p className="text-xs text-muted-foreground">
                  Read it off the executed agreement. Until a real term is recorded the clawback
                  reserve rests on a {DEFAULT_EPO_CLAWBACK_DAYS}-day platform assumption, and a
                  wrong window misstates the largest contingent liability on the balance sheet.
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="approval-reason">Reason</Label>
            <Input
              id="approval-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this changing?"
              data-testid="input-approval-reason"
            />
            <p className="text-xs text-muted-foreground">
              Required in both directions — withdrawing an approval matters as much as granting one.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="button-approval-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
            data-testid="button-approval-save"
          >
            {mutation.isPending ? "Recording…" : "Record change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Contract terms — the correction path (F-23)
// ---------------------------------------------------------------------------

function ContractTermsDialog({
  lender, onClose, onSaved, onError,
}: {
  lender: WholesaleLenderRow;
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [epoDays, setEpoDays] = useState(
    lender.epoClawbackDays ? String(lender.epoClawbackDays) : "",
  );
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/wholesale-lenders/${lender.id}/contract-terms`, {
        // Blank clears the term back to "no agreement term on record", which
        // returns the register to its flagged assumption — an honest state,
        // not a missing value.
        epoClawbackDays: epoDays.trim() === "" ? null : Number(epoDays),
        reason,
      }),
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid="dialog-contract-terms">
        <DialogHeader>
          <DialogTitle>Contract terms — {lender.lenderName}</DialogTitle>
          <DialogDescription>
            Correct a term recorded from the executed agreement. This moves the clawback reserve,
            so the change is audited with its previous and next values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="terms-epo-days">EPO clawback window (days)</Label>
            <Input
              id="terms-epo-days"
              type="number"
              min={1}
              value={epoDays}
              onChange={e => setEpoDays(e.target.value)}
              data-testid="input-terms-epo-days"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to record that no agreement term is on file — the reserve then falls back
              to the {DEFAULT_EPO_CLAWBACK_DAYS}-day assumption and is flagged as assumed.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms-reason">Reason</Label>
            <Input
              id="terms-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. corrected against executed agreement §7.2"
              data-testid="input-terms-reason"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="button-terms-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={reason.trim().length === 0 || mutation.isPending}
            data-testid="button-terms-save"
          >
            {mutation.isPending ? "Saving…" : "Save terms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create — intentionally cannot set authorization
// ---------------------------------------------------------------------------

function CreateLenderDialog({
  onClose, onSaved, onError,
}: {
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    lenderId: "",
    lenderName: "",
    lenderCode: "",
    primaryContact: "",
    contactEmail: "",
    portalUrl: "",
    specialty: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/wholesale-lenders", {
        lenderId: form.lenderId.trim(),
        lenderName: form.lenderName.trim(),
        lenderCode: form.lenderCode.trim().toUpperCase(),
        ...(form.primaryContact.trim() ? { primaryContact: form.primaryContact.trim() } : {}),
        ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
        ...(form.portalUrl.trim() ? { portalUrl: form.portalUrl.trim() } : {}),
        ...(form.specialty.trim() ? { specialty: form.specialty.trim() } : {}),
      }),
    onSuccess: onSaved,
    onError,
  });

  const canSave =
    form.lenderId.trim().length > 0 &&
    form.lenderName.trim().length > 0 &&
    form.lenderCode.trim().length > 0;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent data-testid="dialog-create-lender">
        <DialogHeader>
          <DialogTitle>Add wholesale lender</DialogTitle>
          <DialogDescription>
            A new lender starts as a <strong>target</strong> with no agreement on record. That is
            deliberate: approval is a separate, audited step that asserts an executed broker
            agreement exists.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lender-id">Lender id</Label>
              <Input
                id="lender-id"
                value={form.lenderId}
                onChange={set("lenderId")}
                placeholder="uwm"
                data-testid="input-lender-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lender-code">Lender code</Label>
              <Input
                id="lender-code"
                value={form.lenderCode}
                onChange={set("lenderCode")}
                placeholder="UWM"
                data-testid="input-lender-code"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lender-name">Legal name</Label>
            <Input
              id="lender-name"
              value={form.lenderName}
              onChange={set("lenderName")}
              placeholder="United Wholesale Mortgage, LLC"
              data-testid="input-lender-name"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lender-contact">Primary contact (AE)</Label>
              <Input
                id="lender-contact"
                value={form.primaryContact}
                onChange={set("primaryContact")}
                data-testid="input-lender-contact"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lender-email">Contact email</Label>
              <Input
                id="lender-email"
                type="email"
                value={form.contactEmail}
                onChange={set("contactEmail")}
                data-testid="input-lender-email"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lender-portal">Broker portal URL</Label>
              <Input
                id="lender-portal"
                value={form.portalUrl}
                onChange={set("portalUrl")}
                placeholder="https://…"
                data-testid="input-lender-portal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lender-specialty">Specialty</Label>
              <Input
                id="lender-specialty"
                value={form.specialty}
                onChange={set("specialty")}
                placeholder="Non-QM / bank statement"
                data-testid="input-lender-specialty"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} data-testid="button-create-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
            data-testid="button-create-save"
          >
            {mutation.isPending ? "Adding…" : "Add lender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
