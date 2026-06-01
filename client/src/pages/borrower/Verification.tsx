import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { LoanApplication, Verification } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Briefcase,
  User,
  DollarSign,
  Building2,
  Shield,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";

interface DashboardData {
  applications: LoanApplication[];
}

interface VerificationConfig {
  plaidConfigured: boolean;
  supportedVerificationTypes: string[];
}

const verificationTypes = [
  {
    type: "employment",
    title: "Employment Verification",
    description: "Verify your current employment status and employer information",
    icon: Briefcase,
    required: true,
  },
  {
    type: "identity",
    title: "Identity Verification",
    description: "Confirm your identity through your financial institution",
    icon: User,
    required: true,
  },
  {
    type: "income",
    title: "Income Verification",
    description: "Verify your income through payroll records",
    icon: DollarSign,
    required: false,
  },
  {
    type: "assets",
    title: "Asset Verification",
    description: "Connect your bank accounts to verify assets",
    icon: Building2,
    required: false,
  },
];

function getStatusBadge(status: string) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Not Started" },
    in_progress: { variant: "outline", label: "In Progress" },
    verified: { variant: "default", label: "Verified" },
    failed: { variant: "destructive", label: "Failed" },
    expired: { variant: "secondary", label: "Expired" },
  };
  const c = config[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function PlaidLinkButton({
  applicationId,
  verificationType,
  onSuccess,
  disabled,
}: {
  applicationId: string;
  verificationType: string;
  onSuccess: () => void;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkTokenId, setLinkTokenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createLinkTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/verifications/link-token", {
        applicationId,
        verificationType,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setLinkToken(data.linkToken);
      setLinkTokenId(data.linkTokenId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start verification",
        variant: "destructive",
      });
    },
  });

  const exchangeTokenMutation = useMutation({
    mutationFn: async (publicToken: string) => {
      const response = await apiRequest("POST", "/api/verifications/exchange", {
        publicToken,
        linkTokenId,
        applicationId,
        verificationType,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification Started",
        description: "Your verification is being processed.",
      });
      setLinkToken(null);
      setLinkTokenId(null);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to complete verification",
        variant: "destructive",
      });
    },
  });

  const handlePlaidSuccess = useCallback(
    (publicToken: string) => {
      exchangeTokenMutation.mutate(publicToken);
    },
    [exchangeTokenMutation]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => {
      setIsLoading(false);
    },
  });

  const handleClick = async () => {
    if (linkToken && ready) {
      setIsLoading(true);
      open();
    } else {
      createLinkTokenMutation.mutate();
    }
  };

  // Auto-open when link token is ready
  if (linkToken && ready && !isLoading) {
    setIsLoading(true);
    open();
  }

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || createLinkTokenMutation.isPending || exchangeTokenMutation.isPending}
      data-testid={`button-verify-${verificationType}`}
    >
      {createLinkTokenMutation.isPending || exchangeTokenMutation.isPending ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <Shield className="mr-2 h-4 w-4" />
          Verify Now
        </>
      )}
    </Button>
  );
}

export default function VerificationPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  const { data: configData } = useQuery<VerificationConfig>({
    queryKey: ["/api/verifications/config/status"],
    enabled: !authLoading && !!user,
  });

  const applications = dashboardData?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const { data: verifications, isLoading: verificationsLoading, refetch } = useQuery<Verification[]>({
    queryKey: ["/api/verifications/application", activeApplication?.id],
    enabled: !!activeApplication,
  });

  const getVerificationStatus = (type: string) => {
    const v = verifications?.find((ver) => ver.verificationType === type);
    return v?.status || "pending";
  };

  const getVerification = (type: string) => {
    return verifications?.find((ver) => ver.verificationType === type);
  };

  const handleVerificationSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  if (authLoading || dashboardLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const completedCount = verifications?.filter((v) => v.status === "verified").length || 0;
  const totalRequired = verificationTypes.filter((v) => v.required).length;

  return (
    <>
      <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-verification-title">
              Verification Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Verify your employment and identity to speed up your loan approval
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {!activeApplication ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">No Active Application</h3>
                  <p className="text-center text-muted-foreground mb-4">
                    Start a loan application to begin the verification process.
                  </p>
                  <Link href="/apply">
                    <Button data-testid="button-start-application">Start Application</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : !configData?.plaidConfigured ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="mb-4 h-12 w-12 text-yellow-500" />
                  <h3 className="mb-2 text-lg font-semibold">Verification Service Setup Required</h3>
                  <p className="text-center text-muted-foreground mb-4">
                    The automated verification service requires configuration. Please contact support or your loan officer will verify your documents manually.
                  </p>
                  <Link href="/tasks">
                    <Button variant="outline" data-testid="button-view-tasks">
                      View Manual Tasks
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="mb-8">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">Verification Progress</h3>
                        <p className="text-sm text-muted-foreground">
                          {completedCount} of {totalRequired} required verifications complete
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {completedCount >= totalRequired ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            All Required Complete
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                  {verificationTypes.map((vType) => {
                    const status = getVerificationStatus(vType.type);
                    const verification = getVerification(vType.type);
                    const Icon = vType.icon;
                    const isVerified = status === "verified";

                    return (
                      <Card
                        key={vType.type}
                        className={isVerified ? "border-green-200 dark:border-green-800" : ""}
                        data-testid={`card-verification-${vType.type}`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                isVerified 
                                  ? "bg-green-100 dark:bg-green-900/30" 
                                  : "bg-muted"
                              }`}>
                                {isVerified ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Icon className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <CardTitle className="text-base">{vType.title}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  {vType.required && (
                                    <Badge variant="outline" className="text-xs">Required</Badge>
                                  )}
                                  {getStatusBadge(status)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            {vType.description}
                          </p>

                          {verification && verification.verifiedAt && (
                            <p className="text-xs text-muted-foreground mb-4">
                              Verified on {format(new Date(verification.verifiedAt), "MMM d, yyyy")}
                            </p>
                          )}

                          {verification && vType.type === "employment" && verification.employerName && (
                            <div className="rounded-lg bg-muted p-3 mb-4">
                              <p className="text-sm font-medium">{verification.employerName}</p>
                              {verification.jobTitle && (
                                <p className="text-xs text-muted-foreground">{verification.jobTitle}</p>
                              )}
                            </div>
                          )}

                          {!isVerified && (
                            <PlaidLinkButton
                              applicationId={activeApplication.id}
                              verificationType={vType.type}
                              onSuccess={handleVerificationSuccess}
                              disabled={status === "in_progress"}
                            />
                          )}

                          {status === "in_progress" && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Processing verification...
                            </div>
                          )}

                          {status === "failed" && (
                            <div className="space-y-2">
                              <p className="text-sm text-destructive">
                                Verification failed. Please try again.
                              </p>
                              <PlaidLinkButton
                                applicationId={activeApplication.id}
                                verificationType={vType.type}
                                onSuccess={handleVerificationSuccess}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle className="text-base">Why Verify?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Faster loan processing - skip manual document review</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Secure connection through Plaid - we never see your login credentials</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Industry-standard encryption protects your data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Compliant with GSE (Fannie Mae/Freddie Mac) requirements</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}

      <Card className="mb-6" data-testid="card-cross-link-identity">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Looking for identity verification?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Knowledge-based authentication (KBA) and KYC checks are handled on a separate page.
              </p>
              <Link href="/identity-verification">
                <Button variant="outline" size="sm" className="mt-2 gap-1" data-testid="button-goto-identity">
                  Go to Identity Verification
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
          </div>
    </>
  );
}
