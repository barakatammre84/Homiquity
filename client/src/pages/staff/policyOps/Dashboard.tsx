// The policy-ops dashboard shell: profile list, tabs, and composition of the tool panels.
// Extracted verbatim from PolicyOps.tsx.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  ChevronRight,
  Edit,
  FileText,
  RefreshCw,
  Shield,
  Loader2,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { type PolicyProfile, type RuleCategory, RULE_CATEGORIES, StatusBadge } from "./model";
import { PolicyProfileView } from "./ProfileView";
import { RuleEditor } from "./RuleEditor";
import { MaterialityMatrix } from "./MaterialityMatrix";
import { AuditTrail } from "./AuditTrail";

export function PolicyOpsDashboard() {
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
    <PageShell
      width="full"
      title="Policy Operations"
      subtitle="Manage GSE-aligned underwriting policies without code changes"
      titleTestId="text-policy-ops-title"
      contentClassName="space-y-6"
      headerAction={
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh-policies">
            <RefreshCw className="h-4 w-4 mr-2" />
            Check for Updates
          </Button>
          <Button data-testid="button-create-policy">
            Create Policy Draft
          </Button>
        </div>
      }
    >

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
    </PageShell>
  );
}

