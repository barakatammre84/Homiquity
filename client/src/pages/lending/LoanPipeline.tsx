import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoanApplication, LoanCondition, Document, ApplicationProperty, LoanOption } from "@shared/schema";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  Phone,
  Calendar,
  ShieldCheck,
  Home,
  Banknote,
  ClipboardList,
  Timer,
  CheckCheck,
  AlertTriangle,
  Info,
  Plus,
  MapPin,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface PipelineData {
  progress: {
    stageProgress: number;
    documentsComplete: number;
    documentsTotal: number;
    conditionsCleared: number;
    conditionsTotal: number;
    readyForNextStage: boolean;
    blockers: string[];
    nextSteps: string[];
  };
  summary: {
    applicationId: string;
    currentStage: string;
    priority: "urgent" | "high" | "normal";
    daysInPipeline: number;
    estimatedClosingDays: number;
    completionPercentage: number;
    documentsRequired: number;
    documentsReceived: number;
    conditionsTotal: number;
    conditionsCleared: number;
    lastActivityAt: Date;
    assignedLO: string | null;
    targetCloseDate: Date | null;
  };
  milestones: Record<string, Date | null>;
  conditions: LoanCondition[];
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId?: string;
}

interface ApplicationData {
  application: LoanApplication;
  options: LoanOption[];
  documents: Document[];
  activities: ActivityItem[];
}

const STAGE_ORDER = [
  { key: "application", label: "Application", icon: FileText },
  { key: "pre_approval", label: "Pre-Approval", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: ClipboardList },
  { key: "underwriting", label: "Underwriting", icon: ShieldCheck },
  { key: "conditional_approval", label: "Conditional", icon: AlertCircle },
  { key: "clear_to_close", label: "Clear to Close", icon: CheckCheck },
  { key: "funded", label: "Funded", icon: Banknote },
];

function getStageIndex(stage: string): number {
  const idx = STAGE_ORDER.findIndex(s => s.key === stage);
  return idx >= 0 ? idx : 0;
}

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export default function LoanPipeline() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showAddPropertyDialog, setShowAddPropertyDialog] = useState(false);
  const [showDealFellThroughDialog, setShowDealFellThroughDialog] = useState(false);
  const [selectedPropertyForAction, setSelectedPropertyForAction] = useState<string | null>(null);
  const [dealFellThroughReason, setDealFellThroughReason] = useState("");
  const [newProperty, setNewProperty] = useState({
    address: "",
    city: "",
    state: "",
    zipCode: "",
    propertyType: "single_family",
    purchasePrice: "",
    downPayment: "",
  });

  const { data: appData, isLoading: appLoading } = useQuery<ApplicationData>({
    queryKey: ['/api/loan-applications', applicationId],
    enabled: !!applicationId && !authLoading,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: ['/api/loan-applications', applicationId, 'pipeline'],
    enabled: !!applicationId && !authLoading,
  });

  const { data: applicationProperties = [], isLoading: propertiesLoading } = useQuery<ApplicationProperty[]>({
    queryKey: ['/api/loan-applications', applicationId, 'properties'],
    enabled: !!applicationId && !authLoading,
  });

  const addPropertyMutation = useMutation({
    mutationFn: async (propertyData: typeof newProperty) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties`, propertyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId] });
      setShowAddPropertyDialog(false);
      setNewProperty({
        address: "",
        city: "",
        state: "",
        zipCode: "",
        propertyType: "single_family",
        purchasePrice: "",
        downPayment: "",
      });
      toast({
        title: "Property Added",
        description: "New property has been added to your application.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const switchPropertyMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties/${propertyId}/switch`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId] });
      toast({
        title: "Property Switched",
        description: "Your application has been updated to the new property.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to switch property. Please try again.",
        variant: "destructive",
      });
    },
  });

  const markDealFellThroughMutation = useMutation({
    mutationFn: async ({ propertyId, reason }: { propertyId: string; reason: string }) => {
      return await apiRequest("POST", `/api/loan-applications/${applicationId}/properties/${propertyId}/deal-fell-through`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'properties'] });
      setShowDealFellThroughDialog(false);
      setSelectedPropertyForAction(null);
      setDealFellThroughReason("");
      toast({
        title: "Deal Status Updated",
        description: "The property has been marked as deal fell through.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update deal status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = authLoading || appLoading || pipelineLoading;

  if (isLoading) {
    return (
      <div className="overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const application = appData?.application;
  const documents = appData?.documents || [];
  const pipeline = pipelineData;

  if (!application) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Application Not Found</CardTitle>
            <CardDescription>We couldn't find this loan application.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentStage = pipeline?.summary?.currentStage || application.status || "application";
  const currentStageIndex = getStageIndex(currentStage);
  const defaultProgress = {
    stageProgress: 0,
    documentsComplete: 0,
    documentsTotal: 0,
    conditionsCleared: 0,
    conditionsTotal: 0,
    readyForNextStage: false,
    blockers: [] as string[],
    nextSteps: [] as string[],
  };
  const progress = { ...defaultProgress, ...pipeline?.progress };
  const summary = pipeline?.summary || {
    daysInPipeline: 0,
    estimatedClosingDays: 21,
    completionPercentage: 0,
  };

  const outstandingConditions = (pipeline?.conditions || []).filter(
    c => c.status === "outstanding" || c.status === "submitted"
  );
  const clearedConditions = (pipeline?.conditions || []).filter(
    c => c.status === "cleared" || c.status === "waived"
  );

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                  Loan Progress
                </h1>
                <p className="text-muted-foreground">
                  Track your mortgage application every step of the way
                </p>
              </div>
              <div className="flex items-center gap-2">
                {summary.estimatedClosingDays > 0 && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-est-close">
                    <Calendar className="h-3 w-3" />
                    Est. {summary.estimatedClosingDays} days to close
                  </Badge>
                )}
              </div>
            </div>

            <Card data-testid="card-stage-timeline">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">Stage Timeline</CardTitle>
                  <Badge 
                    variant={currentStage === "funded" ? "default" : "secondary"}
                    data-testid="badge-current-stage"
                  >
                    {formatStageLabel(currentStage)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="flex items-center justify-between">
                    {STAGE_ORDER.map((stage, idx) => {
                      const isComplete = idx < currentStageIndex;
                      const isCurrent = idx === currentStageIndex;
                      const isPending = idx > currentStageIndex;
                      const Icon = stage.icon;

                      return (
                        <div key={stage.key} className="flex flex-col items-center relative z-10">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                              isComplete
                                ? "border-primary bg-primary text-primary-foreground"
                                : isCurrent
                                ? "border-primary bg-background text-primary"
                                : "border-muted bg-muted text-muted-foreground"
                            }`}
                            data-testid={`stage-indicator-${stage.key}`}
                          >
                            {isComplete ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Icon className="h-5 w-5" />
                            )}
                          </div>
                          <span
                            className={`mt-2 text-xs font-medium text-center max-w-[60px] ${
                              isCurrent ? "text-primary" : isPending ? "text-muted-foreground" : ""
                            }`}
                          >
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0 mx-5">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width: `${(currentStageIndex / (STAGE_ORDER.length - 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Property Management Section */}
            <Card data-testid="card-property-management">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Property</CardTitle>
                  </div>
                  <Dialog open={showAddPropertyDialog} onOpenChange={setShowAddPropertyDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-add-property">
                        <Plus className="mr-1 h-4 w-4" />
                        Add Property
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add New Property</DialogTitle>
                        <DialogDescription>
                          If your current deal fell through, add a new property to continue with your pre-approval.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Search Address</Label>
                          <AddressInput
                            placeholder="Start typing an address..."
                            onSelect={(result) => setNewProperty({
                              ...newProperty,
                              address: result.streetAddress || result.formattedAddress,
                              city: result.city,
                              state: result.state,
                              zipCode: result.zip,
                            })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              placeholder="City"
                              value={newProperty.city}
                              onChange={(e) => setNewProperty({ ...newProperty, city: e.target.value })}
                              data-testid="input-property-city"
                            />
                          </div>
                          <div>
                            <Label htmlFor="state">State</Label>
                            <Input
                              id="state"
                              placeholder="CA"
                              value={newProperty.state}
                              onChange={(e) => setNewProperty({ ...newProperty, state: e.target.value })}
                              data-testid="input-property-state"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="zipCode">Zip Code</Label>
                            <Input
                              id="zipCode"
                              placeholder="90210"
                              value={newProperty.zipCode}
                              onChange={(e) => setNewProperty({ ...newProperty, zipCode: e.target.value })}
                              data-testid="input-property-zip"
                            />
                          </div>
                          <div>
                            <Label htmlFor="propertyType">Property Type</Label>
                            <Select
                              value={newProperty.propertyType}
                              onValueChange={(value) => setNewProperty({ ...newProperty, propertyType: value })}
                            >
                              <SelectTrigger data-testid="select-property-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single_family">Single Family</SelectItem>
                                <SelectItem value="condo">Condo</SelectItem>
                                <SelectItem value="townhouse">Townhouse</SelectItem>
                                <SelectItem value="multi_family">Multi-Family</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="purchasePrice">Purchase Price</Label>
                            <Input
                              id="purchasePrice"
                              placeholder="$500,000"
                              value={newProperty.purchasePrice}
                              onChange={(e) => setNewProperty({ ...newProperty, purchasePrice: e.target.value })}
                              data-testid="input-property-price"
                            />
                          </div>
                          <div>
                            <Label htmlFor="downPayment">Down Payment</Label>
                            <Input
                              id="downPayment"
                              placeholder="$100,000"
                              value={newProperty.downPayment}
                              onChange={(e) => setNewProperty({ ...newProperty, downPayment: e.target.value })}
                              data-testid="input-property-downpayment"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddPropertyDialog(false)}
                          data-testid="button-cancel-add-property"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => addPropertyMutation.mutate(newProperty)}
                          disabled={!newProperty.address || !newProperty.purchasePrice || addPropertyMutation.isPending}
                          data-testid="button-submit-property"
                        >
                          {addPropertyMutation.isPending ? "Adding..." : "Add Property"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>
                  {applicationProperties.length > 1
                    ? `You have ${applicationProperties.length} properties on this application`
                    : "Manage properties for your loan application"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {applicationProperties.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                    <Home className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No properties added yet</p>
                    <p className="text-xs mt-1">
                      {application.propertyAddress 
                        ? `Current: ${application.propertyAddress}`
                        : "Add a property to track your home purchase"}
                    </p>
                  </div>
                ) : (
                  applicationProperties.map((property) => (
                    <div
                      key={property.id}
                      className={`rounded-lg border p-4 ${
                        property.isCurrentProperty ? "border-primary bg-primary/5" : ""
                      } ${property.status === "deal_fell_through" ? "opacity-60" : ""}`}
                      data-testid={`property-card-${property.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{property.address}</p>
                            {property.isCurrentProperty && (
                              <Badge variant="default" className="text-xs" data-testid="badge-current-property">
                                Current
                              </Badge>
                            )}
                            {property.status === "deal_fell_through" && (
                              <Badge variant="secondary" className="text-xs">
                                Deal Fell Through
                              </Badge>
                            )}
                            {property.status === "offer_pending" && (
                              <Badge variant="outline" className="text-xs">
                                Offer Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {[property.city, property.state, property.zipCode].filter(Boolean).join(", ")}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>
                              <span className="text-muted-foreground">Price:</span>{" "}
                              <span className="font-medium">{formatCurrency(property.purchasePrice)}</span>
                            </span>
                            {property.downPayment && (
                              <span>
                                <span className="text-muted-foreground">Down:</span>{" "}
                                <span className="font-medium">{formatCurrency(property.downPayment)}</span>
                              </span>
                            )}
                          </div>
                          {property.notes && property.status === "deal_fell_through" && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Reason: {property.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {!property.isCurrentProperty && property.status !== "deal_fell_through" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => switchPropertyMutation.mutate(property.id)}
                              disabled={switchPropertyMutation.isPending}
                              data-testid={`button-switch-property-${property.id}`}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Switch
                            </Button>
                          )}
                          {property.isCurrentProperty && property.status !== "deal_fell_through" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedPropertyForAction(property.id);
                                setShowDealFellThroughDialog(true);
                              }}
                              data-testid={`button-deal-fell-through-${property.id}`}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Deal Fell Through
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Deal Fell Through Dialog */}
            <Dialog open={showDealFellThroughDialog} onOpenChange={setShowDealFellThroughDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Deal Fell Through</DialogTitle>
                  <DialogDescription>
                    We're sorry to hear that. Let us know why so we can help you find a new property.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Inspection issues, seller backed out, financing issues..."
                    value={dealFellThroughReason}
                    onChange={(e) => setDealFellThroughReason(e.target.value)}
                    className="mt-2"
                    data-testid="input-deal-fell-through-reason"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDealFellThroughDialog(false);
                      setSelectedPropertyForAction(null);
                      setDealFellThroughReason("");
                    }}
                    data-testid="button-cancel-deal-fell-through"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedPropertyForAction) {
                        markDealFellThroughMutation.mutate({
                          propertyId: selectedPropertyForAction,
                          reason: dealFellThroughReason,
                        });
                      }
                    }}
                    disabled={markDealFellThroughMutation.isPending}
                    data-testid="button-confirm-deal-fell-through"
                  >
                    {markDealFellThroughMutation.isPending ? "Updating..." : "Confirm"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="grid gap-4 md:grid-cols-3">
              <Card data-testid="card-stat-documents">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-docs-count">
                        {progress.documentsComplete}/{progress.documentsTotal}
                      </p>
                      <p className="text-sm text-muted-foreground">Documents Submitted</p>
                    </div>
                  </div>
                  <Progress 
                    value={progress.documentsTotal > 0 ? (progress.documentsComplete / progress.documentsTotal) * 100 : 0} 
                    className="mt-4"
                  />
                </CardContent>
              </Card>

              <Card data-testid="card-stat-conditions">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                      <CheckCheck className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-conditions-count">
                        {progress.conditionsCleared}/{progress.conditionsTotal}
                      </p>
                      <p className="text-sm text-muted-foreground">Conditions Cleared</p>
                    </div>
                  </div>
                  <Progress 
                    value={progress.conditionsTotal > 0 ? (progress.conditionsCleared / progress.conditionsTotal) * 100 : 0} 
                    className="mt-4"
                  />
                </CardContent>
              </Card>

              <Card data-testid="card-stat-timeline">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                      <Timer className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-days-pipeline">
                        Day {summary.daysInPipeline}
                      </p>
                      <p className="text-sm text-muted-foreground">In Pipeline</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3" />
                    Target: {summary.estimatedClosingDays} days to close
                  </div>
                </CardContent>
              </Card>
            </div>

            {(progress.blockers?.length || 0) > 0 && (
              <Card className="border-destructive/50" data-testid="card-blockers">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-lg text-destructive">Action Required</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {progress.blockers.map((blocker, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Circle className="mt-1 h-2 w-2 flex-shrink-0 fill-destructive text-destructive" />
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {(progress.nextSteps?.length || 0) > 0 && (progress.blockers?.length || 0) === 0 && (
              <Card className="border-primary/50" data-testid="card-next-steps">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Next Steps</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {progress.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {outstandingConditions.length > 0 && (
              <Card data-testid="card-outstanding-conditions">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">Outstanding Items</CardTitle>
                    </div>
                    <Badge variant="secondary" data-testid="badge-outstanding-count">
                      {outstandingConditions.length} remaining
                    </Badge>
                  </div>
                  <CardDescription>
                    Complete these items to move your loan forward
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {outstandingConditions.map((condition) => (
                    <div
                      key={condition.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                      data-testid={`condition-item-${condition.id}`}
                    >
                      <div className="mt-0.5">
                        {condition.status === "submitted" ? (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{condition.title}</p>
                          <Badge 
                            variant={condition.status === "submitted" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {condition.status === "submitted" ? "Under Review" : "Needed"}
                          </Badge>
                          {condition.priority === "prior_to_approval" && (
                            <Badge variant="destructive" className="text-xs">Critical</Badge>
                          )}
                        </div>
                        {condition.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {condition.description}
                          </p>
                        )}
                      </div>
                      <Link href={`/documents?condition=${condition.id}`}>
                        <Button size="sm" variant="outline" data-testid={`button-upload-${condition.id}`}>
                          <Upload className="mr-1 h-4 w-4" />
                          Upload
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Link href="/documents" className="w-full">
                    <Button className="w-full" data-testid="button-view-all-documents">
                      <FileText className="mr-2 h-4 w-4" />
                      View All Documents
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            )}

            {clearedConditions.length > 0 && (
              <Card data-testid="card-cleared-conditions">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCheck className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-lg">Cleared Items</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {clearedConditions.slice(0, 5).map((condition) => (
                      <div
                        key={condition.id}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                        data-testid={`cleared-item-${condition.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>{condition.title}</span>
                      </div>
                    ))}
                    {clearedConditions.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        +{clearedConditions.length - 5} more cleared
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-loan-summary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Loan Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Purchase Price</p>
                    <p className="text-lg font-semibold" data-testid="text-purchase-price">
                      {formatCurrency(application.purchasePrice || "0")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Down Payment</p>
                    <p className="text-lg font-semibold" data-testid="text-down-payment">
                      {formatCurrency(application.downPayment || "0")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pre-Approval Amount</p>
                    <p className="text-lg font-semibold text-primary" data-testid="text-preapproval">
                      {formatCurrency(application.preApprovalAmount || "0")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Property Type</p>
                    <p className="text-lg font-semibold capitalize" data-testid="text-property-type">
                      {application.propertyType?.replace(/_/g, " ") || "Single Family"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-need-help">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Need Help?</p>
                    <p className="text-sm text-muted-foreground">
                      Your loan officer is here to assist
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" data-testid="button-schedule-call">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Call
                  </Button>
                  <Button data-testid="button-message-lo">
                    <Phone className="mr-2 h-4 w-4" />
                    Contact
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
    </>
  );
}
