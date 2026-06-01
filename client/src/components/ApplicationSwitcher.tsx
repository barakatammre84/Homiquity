import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LoanApplication } from "@shared/schema";
import {
  ChevronDown,
  Home,
  RefreshCw,
  CreditCard,
  Plus,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react";

interface ApplicationSwitcherProps {
  applications: LoanApplication[];
  activeApplicationId?: string;
  onSelectApplication: (app: LoanApplication) => void;
}

const WITHDRAWAL_REASONS = [
  { value: "found_another_lender", label: "Found another lender" },
  { value: "no_longer_buying", label: "No longer buying a home" },
  { value: "financial_situation", label: "Change in financial situation" },
  { value: "property_issue", label: "Issue with the property" },
  { value: "timeline_changed", label: "Timeline changed" },
  { value: "rates_too_high", label: "Interest rates too high" },
  { value: "other", label: "Other reason" },
];

function getLoanPurposeLabel(purpose: string | null | undefined): string {
  switch (purpose?.toLowerCase()) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    case "cash_out":
      return "Cash-Out Refi";
    case "heloc":
      return "HELOC";
    default:
      return "Purchase";
  }
}

function getLoanPurposeIcon(purpose: string | null | undefined) {
  switch (purpose?.toLowerCase()) {
    case "refinance":
    case "cash_out":
      return RefreshCw;
    case "heloc":
      return CreditCard;
    default:
      return Home;
  }
}

function getOccupancyLabel(occupancy: string | null | undefined): string {
  switch (occupancy?.toLowerCase()) {
    case "primary_residence":
    case "primary":
      return "Primary";
    case "second_home":
    case "secondary":
      return "Secondary";
    case "investment":
      return "Investment";
    default:
      return "Primary";
  }
}

function getStatusBadge(status: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (status) {
    case "pre_approved":
      return { label: "Pre-Approved", variant: "default" };
    case "conditionally_approved":
      return { label: "Conditional", variant: "secondary" };
    case "under_review":
      return { label: "In Review", variant: "secondary" };
    case "submitted":
      return { label: "Submitted", variant: "outline" };
    case "draft":
    case "incomplete":
      return { label: "Incomplete", variant: "outline" };
    case "denied":
      return { label: "Denied", variant: "destructive" };
    case "withdrawn":
      return { label: "Withdrawn", variant: "destructive" };
    case "closed":
      return { label: "Closed", variant: "secondary" };
    default:
      return { label: "In Progress", variant: "outline" };
  }
}

function generateReferenceNumber(app: LoanApplication): string {
  const prefix = "BN";
  const idPart = app.id.slice(-6).toUpperCase();
  return `${prefix}-${idPart}`;
}

export function ApplicationSwitcher({ 
  applications, 
  activeApplicationId,
  onSelectApplication 
}: ApplicationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [appToWithdraw, setAppToWithdraw] = useState<LoanApplication | null>(null);
  const [withdrawReason, setWithdrawReason] = useState<string>("");
  const [withdrawDetails, setWithdrawDetails] = useState<string>("");
  const { toast } = useToast();
  
  const activeApp = applications.find(app => app.id === activeApplicationId);
  const Icon = activeApp ? getLoanPurposeIcon(activeApp.loanPurpose) : Home;

  const withdrawMutation = useMutation({
    mutationFn: async ({ applicationId, reason, details }: { applicationId: string; reason: string; details: string }) => {
      return apiRequest("POST", `/api/loan-applications/${applicationId}/withdraw`, { reason, details });
    },
    onSuccess: () => {
      toast({
        title: "Application Withdrawn",
        description: "Your loan application has been withdrawn successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setWithdrawDialogOpen(false);
      setAppToWithdraw(null);
      setWithdrawReason("");
      setWithdrawDetails("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to withdraw application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleWithdrawClick = (app: LoanApplication, e: React.MouseEvent) => {
    e.stopPropagation();
    setAppToWithdraw(app);
    setWithdrawDialogOpen(true);
    setIsOpen(false);
  };

  const handleConfirmWithdraw = () => {
    if (!appToWithdraw || !withdrawReason) return;
    withdrawMutation.mutate({
      applicationId: appToWithdraw.id,
      reason: withdrawReason,
      details: withdrawDetails,
    });
  };
  
  if (applications.length === 0) {
    return (
      <Link href="/apply">
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-start-new-app">
          <Plus className="h-4 w-4" />
          Start Application
        </Button>
      </Link>
    );
  }

  const location = activeApp?.propertyCity && activeApp?.propertyState
    ? `${activeApp.propertyCity}, ${activeApp.propertyState}`
    : activeApp?.propertyState || "Location TBD";

  const loanType = activeApp ? getLoanPurposeLabel(activeApp.loanPurpose) : "";

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="gap-2 h-auto py-1 px-2 flex-wrap"
            data-testid="button-app-switcher"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="h-4 w-4 shrink-0 text-primary" data-testid="icon-app-type" />
              <span className="text-sm font-medium" data-testid="text-location">{location}</span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground" data-testid="text-loan-type">{loanType}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80" data-testid="dropdown-app-switcher">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Your Applications
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {applications.map((app) => {
            const appLocation = app.propertyCity && app.propertyState
              ? `${app.propertyCity}, ${app.propertyState}`
              : app.propertyState || "Location TBD";
            const AppIcon = getLoanPurposeIcon(app.loanPurpose);
            const status = getStatusBadge(app.status);
            const isActive = app.id === activeApplicationId;
            const canWithdraw = !["closed", "denied", "withdrawn"].includes(app.status);
            
            return (
              <DropdownMenuItem
                key={app.id}
                onClick={() => {
                  onSelectApplication(app);
                  setIsOpen(false);
                }}
                data-testid={`dropdown-item-app-${app.id}`}
              >
                <div className="flex items-start gap-3 w-full flex-wrap">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${isActive ? 'bg-primary/20' : 'bg-muted'}`} data-testid={`icon-app-${app.id}`}>
                    <AppIcon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground" data-testid={`text-app-ref-${app.id}`}>
                        {generateReferenceNumber(app)}
                      </span>
                      <Badge variant={status.variant} className="text-[10px]" data-testid={`badge-app-status-${app.id}`}>
                        {status.label}
                      </Badge>
                      {isActive && <Check className="h-3 w-3 text-primary ml-auto" data-testid={`icon-active-${app.id}`} />}
                    </div>
                    <p className="text-sm font-medium truncate" data-testid={`text-app-type-${app.id}`}>
                      {getLoanPurposeLabel(app.loanPurpose)}
                    </p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs text-muted-foreground truncate" data-testid={`text-app-location-${app.id}`}>
                        {appLocation} · {getOccupancyLabel((app as unknown as { occupancyType?: string }).occupancyType)}
                      </p>
                      {canWithdraw && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleWithdrawClick(app, e)}
                          className="text-destructive"
                          data-testid={`button-withdraw-${app.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                          Withdraw
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link 
              href="/apply" 
              className="flex items-center gap-2 flex-wrap"
              data-testid="link-new-application"
            >
              <Plus className="h-4 w-4" />
              <span>Start New Application</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-withdraw">
          <DialogHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-destructive">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle data-testid="dialog-title-withdraw">Withdraw Application?</DialogTitle>
            </div>
            <DialogDescription className="pt-3 text-left" data-testid="dialog-desc-withdraw">
              Are you sure you want to withdraw this loan application?
              <br /><br />
              It will be removed from your account, and all associated data will be permanently inaccessible. For regulatory purposes, this action cannot be undone.
              <br /><br />
              To help us improve, please let us know why you're withdrawing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-reason" data-testid="label-reason">
                Pick a reason for cancelling
              </Label>
              <Select value={withdrawReason} onValueChange={setWithdrawReason}>
                <SelectTrigger id="withdraw-reason" data-testid="select-reason">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {WITHDRAWAL_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value} data-testid={`option-reason-${reason.value}`}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdraw-details" data-testid="label-details">
                Add any extra details...
              </Label>
              <Textarea
                id="withdraw-details"
                placeholder="Optional: Share more about your decision..."
                value={withdrawDetails}
                onChange={(e) => setWithdrawDetails(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-details"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawDialogOpen(false);
                setAppToWithdraw(null);
                setWithdrawReason("");
                setWithdrawDetails("");
              }}
              data-testid="button-cancel-withdraw"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmWithdraw}
              disabled={!withdrawReason || withdrawMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
