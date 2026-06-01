import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  History,
  Home,
  Info,
  Percent,
  RefreshCw,
  Save,
  Settings,
  Shield,
  TrendingDown,
  User,
  Briefcase,
  Building,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

type PolicyAuthority = "FANNIE" | "FREDDIE" | "FHA" | "VA" | "BROKER";
type PolicyStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "RETIRED";
type RuleCategory = "CREDIT" | "INCOME" | "ASSETS" | "LIABILITIES" | "DTI" | "PROPERTY" | "OCCUPANCY" | "COC" | "PRE_APPROVAL" | "BROKER_OVERLAY";

interface PolicyProfile {
  id: string;
  profileId: string;
  authority: PolicyAuthority;
  productType: string;
  version: string;
  status: PolicyStatus;
  effectiveDate: string;
  expirationDate: string | null;
  description: string | null;
  bulletinReference: string | null;
  sourceUrl: string | null;
  parentProfileId: string | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  activatedBy: string | null;
  activatedAt: string | null;
  retiredBy: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PolicyThresholdItem {
  id: string;
  policyProfileId: string;
  category: string;
  thresholdKey: string;
  valueNumeric: string | null;
  valuePercent: string | null;
  valueBool: boolean | null;
  valueEnum: string | null;
  minBound: string | null;
  maxBound: string | null;
  materialityAction: string | null;
  displayName: string | null;
  description: string | null;
  guidelineReference: string | null;
  displayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PolicyProfileDetail extends PolicyProfile {
  thresholds: PolicyThresholdItem[];
  approvals: PolicyApprovalRecord[];
  overlays: unknown[];
}

interface PolicyApprovalRecord {
  id: string;
  policyProfileId: string;
  fromStatus: string;
  toStatus: string;
  action: string;
  actionBy: string;
  actionAt: string | null;
  justification: string | null;
  bulletinReference: string | null;
  rejectionReason: string | null;
  impactedApplicationsCount: number | null;
  impactAssessment: unknown;
  createdAt: string;
}


interface AuditEntry {
  id: string;
  action: string;
  changedBy: string;
  changedAt: string;
  changes: string;
  reason: string;
  policyReference?: string;
}

const RULE_CATEGORIES: { id: RuleCategory; label: string; icon: typeof CreditCard }[] = [
  { id: "CREDIT", label: "Credit", icon: CreditCard },
  { id: "INCOME", label: "Income", icon: DollarSign },
  { id: "ASSETS", label: "Assets", icon: Briefcase },
  { id: "LIABILITIES", label: "Liabilities", icon: TrendingDown },
  { id: "DTI", label: "DTI / DSCR", icon: Percent },
  { id: "PROPERTY", label: "Property", icon: Building },
  { id: "OCCUPANCY", label: "Occupancy", icon: Home },
  { id: "COC", label: "Change-of-Circumstance", icon: RefreshCw },
  { id: "PRE_APPROVAL", label: "Pre-Approval Validity", icon: FileText },
  { id: "BROKER_OVERLAY", label: "Broker Risk Overlay", icon: Shield },
];


function StatusBadge({ status }: { status: PolicyStatus }) {
  const config = {
    DRAFT: { variant: "secondary" as const, icon: Edit },
    PENDING_APPROVAL: { variant: "outline" as const, icon: Clock },
    APPROVED: { variant: "default" as const, icon: Check },
    ACTIVE: { variant: "default" as const, icon: CheckCircle2 },
    RETIRED: { variant: "secondary" as const, icon: XCircle },
  };
  const { variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status.replace("_", " ")}
    </Badge>
  );
}


function PolicyOpsDashboard() {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyProfile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory>("DTI");
  const [activeTab, setActiveTab] = useState("dashboard");
  const { toast } = useToast();

  const { data: policies = [], isLoading: policiesLoading } = useQuery<PolicyProfile[]>({
    queryKey: ['/api/policy-profiles'],
  });

  const activePolicies = policies.filter((p) => p.status === "ACTIVE");
  const draftPolicies = policies.filter((p) => p.status === "DRAFT");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-policy-ops-title">Policy Operations</h1>
          <p className="text-muted-foreground">
            Manage GSE-aligned underwriting policies without code changes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh-policies">
            <RefreshCw className="h-4 w-4 mr-2" />
            Check for Updates
          </Button>
          <Button data-testid="button-create-policy">
            Create Policy Draft
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">Policy Profiles</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Rule Editor</TabsTrigger>
          <TabsTrigger value="materiality" data-testid="tab-materiality">Materiality Matrix</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Active Policy Profiles
                </CardTitle>
                <CardDescription>
                  Currently enforced underwriting policies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {policiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedPolicy(policy);
                        setActiveTab("profiles");
                      }}
                      data-testid={`policy-card-${policy.profileId}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          {policy.authority === "FANNIE" && <span className="text-sm font-bold">FM</span>}
                          {policy.authority === "FREDDIE" && <span className="text-sm font-bold">FH</span>}
                          {policy.authority === "FHA" && <span className="text-sm font-bold">FHA</span>}
                          {policy.authority === "VA" && <span className="text-sm font-bold">VA</span>}
                          {policy.authority === "BROKER" && <Shield className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium">{policy.authority} ({policy.version})</p>
                          <p className="text-sm text-muted-foreground">
                            {policy.productType} • Effective {policy.effectiveDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={policy.status} />
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alerts
                </CardTitle>
                <CardDescription>
                  Items requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-6 text-center" data-testid="alerts-empty-state">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Policy alerts will appear here when GSE updates, pending approvals, or expirations are detected</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Policies</p>
                    <p className="text-2xl font-bold">{policiesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : activePolicies.length}</p>
                  </div>
                  <Shield className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Draft Policies</p>
                    <p className="text-2xl font-bold">{policiesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : draftPolicies.length}</p>
                  </div>
                  <Edit className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Policies</p>
                    <p className="text-2xl font-bold">{policiesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : policies.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold">{policiesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : policies.filter((p) => p.status === "PENDING_APPROVAL").length}</p>
                  </div>
                  <RefreshCw className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-6">
          <PolicyProfileView
            policy={selectedPolicy}
            onBack={() => setSelectedPolicy(null)}
            onEditRules={() => setActiveTab("rules")}
          />
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Rule Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {RULE_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(cat.id)}
                      data-testid={`category-${cat.id}`}
                    >
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>
                  {RULE_CATEGORIES.find((c) => c.id === selectedCategory)?.label} Rules
                </CardTitle>
                <CardDescription>
                  Adjust parameters below. No formulas, no code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RuleEditor category={selectedCategory} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="materiality" className="space-y-6">
          <MaterialityMatrix />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <AuditTrail selectedPolicyId={selectedPolicy?.id || null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PolicyProfileView({
  policy,
  onBack,
  onEditRules,
}: {
  policy: PolicyProfile | null;
  onBack: () => void;
  onEditRules: () => void;
}) {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishReason, setPublishReason] = useState("");
  const { toast } = useToast();

  const { data: policyDetail, isLoading: detailLoading } = useQuery<PolicyProfileDetail>({
    queryKey: ['/api/policy-profiles', policy?.id],
    enabled: !!policy?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ id, justification }: { id: string; justification: string }) => {
      await apiRequest("POST", `/api/policy-profiles/${id}/submit`, { justification });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/policy-profiles'] });
      toast({
        title: "Policy Submitted",
        description: `${policy?.profileId} has been submitted for approval.`,
      });
      setPublishDialogOpen(false);
      setPublishReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!policy) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a policy from the dashboard to view details</p>
        </CardContent>
      </Card>
    );
  }

  const handlePublish = () => {
    submitMutation.mutate({ id: policy.id, justification: publishReason });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} data-testid="button-back-to-dashboard">
          Back to Dashboard
        </Button>
        <div className="flex-1" />
        {policy.status === "DRAFT" && (
          <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-publish-policy">
                Publish Policy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Policy Version</DialogTitle>
                <DialogDescription>
                  This will create an immutable policy version. Existing loans will remain on their current version.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Impact Summary</AlertTitle>
                  <AlertDescription>
                    23 active pre-approvals will remain on the previous version. New applications will use this policy.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Publication (Required)</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Q1 2026 policy update per SEL-2026-01"
                    value={publishReason}
                    onChange={(e) => setPublishReason(e.target.value)}
                    data-testid="input-publish-reason"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={!publishReason || submitMutation.isPending}
                  data-testid="button-confirm-publish"
                >
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm & Publish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{policy.profileId}</CardTitle>
              <CardDescription>
                {policy.authority} • {policy.productType}
              </CardDescription>
            </div>
            <StatusBadge status={policy.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-medium">{policy.version}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Effective Date</p>
              <p className="font-medium">{policy.effectiveDate}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created By</p>
              <p className="font-medium">{policy.createdBy || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Approved By</p>
              <p className="font-medium">{policy.approvedBy || "—"}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{policy.description || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy Thresholds</CardTitle>
            <CardDescription>Key parameters for this policy</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : policyDetail?.thresholds && policyDetail.thresholds.length > 0 ? (
                  policyDetail.thresholds.map((threshold) => (
                    <TableRow key={threshold.id}>
                      <TableCell>{threshold.displayName || threshold.thresholdKey}</TableCell>
                      <TableCell>
                        {threshold.valuePercent != null
                          ? `${(parseFloat(threshold.valuePercent) * 100).toFixed(0)}%`
                          : threshold.valueNumeric != null
                          ? threshold.valueNumeric
                          : threshold.valueBool != null
                          ? (threshold.valueBool ? "Yes" : "No")
                          : threshold.valueEnum || "—"}
                      </TableCell>
                      <TableCell><Badge variant="outline">{threshold.category}</Badge></TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                      No thresholds defined
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage this policy profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onEditRules}
              data-testid="button-edit-rules"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Rule Parameters
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-view-coc">
              <RefreshCw className="h-4 w-4 mr-2" />
              View COC Rules
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-clone-policy">
              <FileText className="h-4 w-4 mr-2" />
              Clone as Draft
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-view-history">
              <History className="h-4 w-4 mr-2" />
              View Version History
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RuleEditor({ category }: { category: RuleCategory }) {
  const [dtiMax, setDtiMax] = useState([43]);
  const [creditScoreMin, setCreditScoreMin] = useState([620]);
  const [ltvMax, setLtvMax] = useState([97]);
  const [reservesMin, setReservesMin] = useState("2");
  const [scheduleERequired, setScheduleERequired] = useState(true);
  const [vacancyFactor, setVacancyFactor] = useState("25");
  const [allowLossOffset, setAllowLossOffset] = useState(false);
  const [incomeHistory, setIncomeHistory] = useState("2");
  const [primaryOccupancy, setPrimaryOccupancy] = useState(true);
  const [secondHomeOccupancy, setSecondHomeOccupancy] = useState(true);
  const [investmentOccupancy, setInvestmentOccupancy] = useState(true);
  const [strongCreditCompensating, setStrongCreditCompensating] = useState(false);
  const [reservesCompensating, setReservesCompensating] = useState(false);
  const [preApprovalValidity, setPreApprovalValidity] = useState("90");
  const [autoExpireOnCOC, setAutoExpireOnCOC] = useState(true);
  const [creditRepullRequired, setCreditRepullRequired] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState("B");
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Draft Saved",
      description: "Changes saved to draft. Publish when ready.",
    });
  };

  if (category === "DTI") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Max Back-End DTI</Label>
            <span className="text-2xl font-bold">{dtiMax[0]}%</span>
          </div>
          <Slider
            value={dtiMax}
            onValueChange={setDtiMax}
            min={36}
            max={50}
            step={1}
            data-testid="slider-dti-max"
          />
          <p className="text-sm text-muted-foreground">
            GSE limit: 36% - 50%. Higher DTI requires compensating factors.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Loan Type Eligibility</Label>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-2">
              <Switch
                checked={primaryOccupancy}
                onCheckedChange={setPrimaryOccupancy}
                data-testid="switch-primary"
              />
              <Label>Primary Residence</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={secondHomeOccupancy}
                onCheckedChange={setSecondHomeOccupancy}
                data-testid="switch-second-home"
              />
              <Label>Second Home</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={investmentOccupancy}
                onCheckedChange={setInvestmentOccupancy}
                data-testid="switch-investment"
              />
              <Label>Investment Property</Label>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Compensating Factors</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Reserves ≥ 6 months</p>
                <p className="text-sm text-muted-foreground">
                  Allows DTI up to {dtiMax[0] + 2}% if enabled
                </p>
              </div>
              <Switch
                checked={reservesCompensating}
                onCheckedChange={setReservesCompensating}
                data-testid="switch-reserves-compensating"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Credit Score 720+</p>
                <p className="text-sm text-muted-foreground">
                  Allows DTI up to {dtiMax[0] + 2}% if enabled
                </p>
              </div>
              <Switch
                checked={strongCreditCompensating}
                onCheckedChange={setStrongCreditCompensating}
                data-testid="switch-credit-compensating"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" data-testid="button-discard-changes">
            Discard Changes
          </Button>
          <Button onClick={handleSave} data-testid="button-save-draft">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "INCOME") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base">Rental Income (Schedule E)</Label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <Label>Schedule E Required</Label>
              <Switch
                checked={scheduleERequired}
                onCheckedChange={setScheduleERequired}
                data-testid="switch-schedule-e"
              />
            </div>
            <div className="space-y-2">
              <Label>Vacancy Factor</Label>
              <Select value={vacancyFactor} onValueChange={setVacancyFactor}>
                <SelectTrigger data-testid="select-vacancy-factor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25% (Standard)</SelectItem>
                  <SelectItem value="15">15% (Conservative)</SelectItem>
                  <SelectItem value="0">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Allow Loss Offset</Label>
                <p className="text-sm text-muted-foreground">Offset rental losses against income</p>
              </div>
              <Switch
                checked={allowLossOffset}
                onCheckedChange={setAllowLossOffset}
                data-testid="switch-loss-offset"
              />
            </div>
            <div className="space-y-2">
              <Label>Min History Required</Label>
              <Select value={incomeHistory} onValueChange={setIncomeHistory}>
                <SelectTrigger data-testid="select-income-history">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" data-testid="button-discard-changes">
            Discard Changes
          </Button>
          <Button onClick={handleSave} data-testid="button-save-draft">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "CREDIT") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Minimum Credit Score</Label>
            <span className="text-2xl font-bold">{creditScoreMin[0]}</span>
          </div>
          <Slider
            value={creditScoreMin}
            onValueChange={setCreditScoreMin}
            min={580}
            max={720}
            step={10}
            data-testid="slider-credit-min"
          />
          <p className="text-sm text-muted-foreground">
            GSE minimum: 620 for conventional. FHA allows 580 with restrictions.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Discard Changes</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "PRE_APPROVAL") {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Label className="text-base">Pre-Approval Validity Period</Label>
          <Select value={preApprovalValidity} onValueChange={setPreApprovalValidity}>
            <SelectTrigger className="w-48" data-testid="select-validity-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days (Standard)</SelectItem>
              <SelectItem value="120">120 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Expiration Controls</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Auto-Expire on COC</p>
                <p className="text-sm text-muted-foreground">
                  Automatically expire when material change detected
                </p>
              </div>
              <Switch
                checked={autoExpireOnCOC}
                onCheckedChange={setAutoExpireOnCOC}
                data-testid="switch-auto-expire"
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Require Credit Re-Pull</p>
                <p className="text-sm text-muted-foreground">
                  Require new credit pull before extending validity
                </p>
              </div>
              <Switch
                checked={creditRepullRequired}
                onCheckedChange={setCreditRepullRequired}
                data-testid="switch-credit-repull"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-base">Confidence Threshold Required</Label>
          <Select value={confidenceThreshold} onValueChange={setConfidenceThreshold}>
            <SelectTrigger className="w-48" data-testid="select-confidence-threshold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A - Strong (85%+)</SelectItem>
              <SelectItem value="B">B - Solid (70%+)</SelectItem>
              <SelectItem value="C">C - Fragile (50%+)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Minimum confidence score to issue pre-approval letter
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline">Discard Changes</Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>
    );
  }

  if (category === "COC") {
    return <COCRuleBuilder />;
  }

  return (
    <div className="py-12 text-center">
      <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-muted-foreground">
        {category} rules coming soon. Select DTI, Income, Credit, Pre-Approval, or COC to configure.
      </p>
    </div>
  );
}

function COCRuleBuilder() {
  const [triggerType, setTriggerType] = useState("");
  const [triggerValue, setTriggerValue] = useState("");
  const [severity, setSeverity] = useState("REVIEW");
  const [appliesTo, setAppliesTo] = useState<string[]>(["FANNIE", "FREDDIE"]);
  const { toast } = useToast();

  const handleAddRule = () => {
    toast({
      title: "COC Rule Added",
      description: "Rule added to draft. Publish policy to activate.",
    });
  };

  return (
    <div className="space-y-8">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Change-of-Circumstance Rules</AlertTitle>
        <AlertDescription>
          Define what changes invalidate a pre-approval. Rules are evaluated for every monitoring event.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Label className="text-base">Trigger Event</Label>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="credit_drop"
                checked={triggerType === "credit_drop"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-credit-drop"
              />
              <Label className="flex items-center gap-2">
                Credit Score Drop ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="20"
                  value={triggerType === "credit_drop" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "credit_drop"}
                  data-testid="input-credit-drop"
                />
                pts
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="new_tradeline"
                checked={triggerType === "new_tradeline"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-new-tradeline"
              />
              <Label>New Tradeline Detected</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="income_change"
                checked={triggerType === "income_change"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-income-change"
              />
              <Label className="flex items-center gap-2">
                Income Change ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="10"
                  value={triggerType === "income_change" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "income_change"}
                  data-testid="input-income-change"
                />
                %
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="asset_decrease"
                checked={triggerType === "asset_decrease"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-asset-decrease"
              />
              <Label className="flex items-center gap-2">
                Asset Decrease ≥
                <Input
                  type="number"
                  className="w-20"
                  placeholder="10"
                  value={triggerType === "asset_decrease" ? triggerValue : ""}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  disabled={triggerType !== "asset_decrease"}
                  data-testid="input-asset-decrease"
                />
                %
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                name="trigger"
                value="employment_change"
                checked={triggerType === "employment_change"}
                onChange={(e) => setTriggerType(e.target.value)}
                className="h-4 w-4"
                data-testid="radio-trigger-employment-change"
              />
              <Label>Employment Change</Label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger data-testid="select-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INFO">Informational</SelectItem>
                <SelectItem value="REVIEW">Re-verification Required</SelectItem>
                <SelectItem value="INVALIDATE">Pre-Approval Invalidation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-base">Applies To</Label>
            <div className="grid grid-cols-2 gap-2">
              {["FANNIE", "FREDDIE", "FHA", "VA"].map((gse) => (
                <div key={gse} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={appliesTo.includes(gse)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAppliesTo([...appliesTo, gse]);
                      } else {
                        setAppliesTo(appliesTo.filter((g) => g !== gse));
                      }
                    }}
                    className="h-4 w-4"
                    data-testid={`checkbox-gse-${gse.toLowerCase()}`}
                  />
                  <Label>{gse}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleAddRule} disabled={!triggerType} data-testid="button-add-coc-rule">
          Add COC Rule
        </Button>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label className="text-base">Existing COC Rules</Label>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trigger</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Credit Score Drop ≥ 20pts</TableCell>
              <TableCell><Badge variant="destructive">Invalidate</Badge></TableCell>
              <TableCell>FANNIE, FREDDIE</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Income Change ≥ 10%</TableCell>
              <TableCell><Badge variant="outline">Re-verify</Badge></TableCell>
              <TableCell>FANNIE, FREDDIE, FHA</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>New Tradeline Detected</TableCell>
              <TableCell><Badge variant="outline">Re-verify</Badge></TableCell>
              <TableCell>All</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MaterialityMatrix() {
  const [editMode, setEditMode] = useState(false);
  const { toast } = useToast();

  const metrics = [
    { metric: "Credit Score Drop", fannie: 20, freddie: 15, fha: 20, va: 20, unit: "pts" },
    { metric: "DTI Change", fannie: 3, freddie: 2, fha: 3, va: 3, unit: "%" },
    { metric: "Asset Loss", fannie: 10, freddie: 10, fha: 5, va: 10, unit: "%" },
    { metric: "Income Decrease", fannie: 10, freddie: 8, fha: 10, va: 10, unit: "%" },
    { metric: "LTV Increase", fannie: 5, freddie: 5, fha: 5, va: 5, unit: "%" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Materiality Threshold Matrix</CardTitle>
            <CardDescription>
              Thresholds that trigger re-evaluation by GSE. Hover for guideline source.
            </CardDescription>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => {
              if (editMode) {
                toast({
                  title: "Changes Saved",
                  description: "Materiality thresholds updated in draft.",
                });
              }
              setEditMode(!editMode);
            }}
            data-testid="button-toggle-edit"
          >
            {editMode ? (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Thresholds
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>Fannie Mae</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: Fannie Mae Selling Guide</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>Freddie Mac</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: Freddie Mac Seller/Servicer Guide</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>FHA</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: HUD Handbook 4000.1</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>VA</TooltipTrigger>
                  <TooltipContent>
                    <p>Source: VA Lender's Handbook</p>
                  </TooltipContent>
                </Tooltip>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((row) => (
              <TableRow key={row.metric}>
                <TableCell className="font-medium">{row.metric}</TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.fannie}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.fannie}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.freddie}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.freddie}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.fha}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.fha}{row.unit}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {editMode ? (
                    <Input
                      type="number"
                      defaultValue={row.va}
                      className="w-20 mx-auto text-center"
                    />
                  ) : (
                    <span>{row.va}{row.unit}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground mt-4">
          Lower values = stricter monitoring. Freddie Mac typically has stricter thresholds.
        </p>
      </CardContent>
    </Card>
  );
}

function AuditTrail({ selectedPolicyId }: { selectedPolicyId: string | null }) {
  const { data: approvals = [], isLoading } = useQuery<PolicyApprovalRecord[]>({
    queryKey: ['/api/policy-approvals', selectedPolicyId],
    enabled: !!selectedPolicyId,
  });

  const entries: AuditEntry[] = approvals.map((a) => ({
    id: a.id,
    action: a.action,
    changedBy: a.actionBy,
    changedAt: a.createdAt || a.actionAt || "",
    changes: `${a.fromStatus} → ${a.toStatus}`,
    reason: a.justification || a.rejectionReason || "",
    policyReference: a.bulletinReference || undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Change Log & Audit Trail
        </CardTitle>
        <CardDescription>
          Complete history of all policy changes. Every modification is logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !selectedPolicyId ? (
            <div className="text-center text-muted-foreground py-8">
              Select a policy from the dashboard to view its audit trail
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No approval history found for this policy
            </div>
          ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 border rounded-lg space-y-3"
                data-testid={`audit-entry-${entry.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-sm text-muted-foreground">{entry.changedAt}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {entry.changedBy}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{entry.changes}</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Reason:</strong> {entry.reason}
                  </p>
                  {entry.policyReference && (
                    <p className="text-sm text-muted-foreground">
                      <strong>Reference:</strong> {entry.policyReference}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function PolicyOps() {
  return <PolicyOpsDashboard />;
}
