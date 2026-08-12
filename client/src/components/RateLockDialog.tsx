import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, loanApplicationKeys } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Lock, RefreshCw, XCircle } from "lucide-react";
import { OPEN_RATE_LOCK_STATUSES } from "@shared/statusVocabularies";
import type { LoanOption, RateLock } from "@shared/schema";
// -----------------------------------------------------------------------------
// Rate-lock desk — the loan officer's lock/extend/cancel control for one file.
//
// Surfaces the rate_locks backend (create/extend/cancel + expiration) that had
// no UI: GET /api/rate-locks/application/:id and POST /api/rate-locks[/:id/...].
// Mirrors SubmissionReadinessDialog — a self-contained per-row dialog that
// fetches lazily on open. The server re-enforces every gate; this is the
// convenience surface, not the enforcement point.
//
// Locking on the borrower's behalf is procedural (Reg Z anti-steering is the
// borrower's own acknowledgement, enforced on the borrower path); this desk is
// internal-staff only.
// -----------------------------------------------------------------------------

const LOCK_PERIODS = [15, 30, 45, 60, 90] as const;

function daysUntil(expiresAt: string | Date): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

interface RateLockDialogProps {
  applicationId: string;
  borrowerName: string;
}

export function RateLockDialog({ applicationId, borrowerName }: RateLockDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [optionId, setOptionId] = useState("");
  const [lockPeriod, setLockPeriod] = useState("30");

  // Segments, not a template string. Written as
  // [`/api/rate-locks/application/${applicationId}`] this fetched the same URL
  // but slipped past `guard:querykeys`, whose regex only fires on a template
  // key written INLINE in `queryKey:` — hoisting it into a const hid it.
  const locksKey = ["/api/rate-locks/application", applicationId] as const;
  const { data: locks, isLoading: locksLoading } = useQuery<RateLock[]>({
    queryKey: locksKey,
    enabled: open,
  });
  const { data: optionsData } = useQuery<{ options: LoanOption[] }>({
    queryKey: loanApplicationKeys.options(applicationId),
    enabled: open,
  });

  const activeLock = locks?.find((lock) => OPEN_RATE_LOCK_STATUSES.includes(lock.status));
  const options = optionsData?.options ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: locksKey });
    // No ["/api/rate-locks/expiring"] here: GET /api/rate-locks/expiring exists
    // on the server but no client surface queries it, so invalidating it was
    // inert. Add it back alongside the query if a expiring-locks view lands.
  };

  const createLock = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rate-locks", {
        applicationId,
        loanOptionId: optionId,
        lockPeriodDays: Number(lockPeriod),
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Rate locked", description: `Locked for ${lockPeriod} days.` });
    },
    onError: (error: Error) => {
      toast({ title: "Could not lock the rate", description: error.message, variant: "destructive" });
    },
  });

  const extendLock = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rate-locks/${activeLock!.id}/extend`, {
        additionalDays: 15,
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Lock extended", description: "Added 15 days to the lock." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not extend the lock", description: error.message, variant: "destructive" });
    },
  });

  const cancelLock = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rate-locks/${activeLock!.id}/cancel`, {
        reason: "Cancelled from LO Command Center",
      });
      return res.json();
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Lock cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not cancel the lock", description: error.message, variant: "destructive" });
    },
  });

  const remaining = activeLock ? daysUntil(activeLock.expiresAt) : null;
  const countdownAmber = remaining !== null && remaining > 3 && remaining <= 7;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`rate-lock-${applicationId}`}>
          <Lock className="mr-1 h-4 w-4" aria-hidden="true" />
          Lock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate lock — {borrowerName}</DialogTitle>
          <DialogDescription>
            Lock, extend, or cancel this file&apos;s rate. Locking on the borrower&apos;s behalf is
            procedural; the borrower still acknowledges the loan-options disclosure separately.
          </DialogDescription>
        </DialogHeader>

        {locksLoading ? (
          <Skeleton className="h-40" data-testid="rate-lock-loading" />
        ) : activeLock ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-bold tabular-nums">{activeLock.interestRate}%</span>
                <Badge
                  variant={remaining !== null && remaining <= 3 ? "destructive" : "outline"}
                  className={countdownAmber ? "bg-warning-subtle text-warning-subtle-foreground" : undefined}
                  data-testid="lock-countdown"
                >
                  <Clock className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {remaining !== null && remaining <= 0
                    ? "Expired"
                    : `${remaining} day${remaining === 1 ? "" : "s"} left`}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>
                  <dt className="inline">Locked </dt>
                  <dd className="inline text-foreground">{new Date(activeLock.lockedAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="inline">Expires </dt>
                  <dd className="inline text-foreground">{new Date(activeLock.expiresAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="inline">Term </dt>
                  <dd className="inline text-foreground">{activeLock.lockPeriodDays} days</dd>
                </div>
                <div>
                  <dt className="inline">Loan </dt>
                  <dd className="inline text-foreground">{activeLock.loanType} · {activeLock.loanTerm}yr</dd>
                </div>
              </dl>
              {(activeLock.extensionCount ?? 0) > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Extended {activeLock.extensionCount}× from the original lock.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={extendLock.isPending}
                onClick={() => extendLock.mutate()}
                data-testid="extend-lock"
              >
                <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                Extend 15 days
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive"
                disabled={cancelLock.isPending}
                onClick={() => cancelLock.mutate()}
                data-testid="cancel-lock"
              >
                <XCircle className="mr-1 h-4 w-4" aria-hidden="true" />
                Cancel lock
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="no-options">
                No priced loan options on this file yet. Price the file first, then lock a rate.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lock-option">Loan option</label>
                  <Select value={optionId} onValueChange={setOptionId}>
                    <SelectTrigger id="lock-option" data-testid="lock-option-select">
                      <SelectValue placeholder="Choose an option to lock" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.interestRate}% · {option.loanType} · {option.loanTerm}yr
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lock-period">Lock period</label>
                  <Select value={lockPeriod} onValueChange={setLockPeriod}>
                    <SelectTrigger id="lock-period" data-testid="lock-period-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCK_PERIODS.map((period) => (
                        <SelectItem key={period} value={String(period)}>{period} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!optionId || createLock.isPending}
                  onClick={() => createLock.mutate()}
                  data-testid="submit-lock"
                >
                  <Lock className="mr-1 h-4 w-4" aria-hidden="true" />
                  Lock rate
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
